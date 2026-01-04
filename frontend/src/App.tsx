import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookStudyData, AppState, Flashcard, QuizQuestion } from './types';
import { fetchBookInfo, fetchFlashcards, fetchQuiz, fetchDeepAnalysis, fetchOtherEditions, searchBooks, forceFetchCover } from './services/apiService';
import { FlashcardItem } from './components/FlashcardItem';
import { Quiz } from './components/Quiz';
import Logo from './components/Logo';
import { BarcodeScanner } from './components/BarcodeScanner';
import { Camera, Search, ChevronRight, Moon, Sun, RefreshCcw, Layout, HelpCircle, Trophy, Heart, User, Calendar, Hash, BookOpen, Building2, Trash2, List, Pencil, Languages, Tag, ChevronDown, ChevronUp, LogOut, ShieldCheck, Mail, Lock } from 'lucide-react';
import { supabase } from './lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

// Last Updated: 2026-01-03 23:25 (THEME FIX V3.0)
const App: React.FC = () => {
    useEffect(() => {
        console.log("App V2.4 Loaded. Mode:", document.documentElement.className);
    }, []);
    const [state, setState] = useState<AppState>(AppState.IDLE);
    const [bookInput, setBookInput] = useState('');
    const [data, setData] = useState<Partial<BookStudyData> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [quizScore, setQuizScore] = useState<number | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAnalyzingDeeply, setIsAnalyzingDeeply] = useState(false);
    const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [sidebarView, setSidebarView] = useState<'info' | 'editions'>('info');
    const [editions, setEditions] = useState<any[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchViewMode, setSearchViewMode] = useState<'grid' | 'list'>('grid');
    const [prevState, setPrevState] = useState<AppState | null>(null);
    const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
    const [isReadMore, setIsReadMore] = useState(false);
    const [searchFilters, setSearchFilters] = useState({ title: '', author: '', publisher: '' });
    const [editionsPage, setEditionsPage] = useState(0);
    const [isFetchingEditions, setIsFetchingEditions] = useState(false);
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [lastQuery, setLastQuery] = useState('');
    const [isDark, setIsDark] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [favorites, setFavorites] = useState<any[]>([]);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showFavoritesModal, setShowFavoritesModal] = useState(false);
    const [headerSearchInput, setHeaderSearchInput] = useState('');
    const synopsisRef = React.useRef<HTMLDivElement>(null);
    const [hasOverflow, setHasOverflow] = useState(false);

    // Supabase States
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [profile, setProfile] = useState<{ is_admin: boolean } | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    // Load history and favorites on mount + Supabase Auth
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            if (session?.user) fetchProfile(session.user.id);
        };

        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
                syncDataToCloud(session.user.id);
            } else {
                setProfile(null);
            }
        });

        const savedHistory = localStorage.getItem('myink_history');
        if (savedHistory) setHistory(JSON.parse(savedHistory));

        const savedFavorites = localStorage.getItem('myink_favorites');
        if (savedFavorites) setFavorites(JSON.parse(savedFavorites));

        setIsDark(false);
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (!error && data) {
            setProfile(data);
        }
    };

    const syncDataToCloud = async (userId: string) => {
        // Initial sync from LocalStorage to Supabase
        const localFavs = JSON.parse(localStorage.getItem('myink_favorites') || '[]');
        const localHist = JSON.parse(localStorage.getItem('myink_history') || '[]');

        if (localFavs.length > 0) {
            for (const book of localFavs) {
                // Check if already in cloud to avoid duplicates
                const { data: exists } = await supabase.from('favorites').select('id').eq('user_id', userId).filter('book_data->>isbn', 'eq', book.isbn).single();
                if (!exists) {
                    await supabase.from('favorites').insert({ user_id: userId, book_data: book });
                }
            }
        }
        if (localHist.length > 0) {
            for (const book of localHist) {
                // Deduplicate history by deleting old entry before adding new (moves to top)
                await supabase.from('search_history').delete().eq('user_id', userId).filter('book_data->>isbn', 'eq', book.isbn);
                await supabase.from('search_history').insert({ user_id: userId, book_data: book });
            }
        }

        // After initial sync, load from cloud
        loadFromCloud(userId);
    };

    const loadFromCloud = async (userId: string) => {
        const { data: cloudFavs } = await supabase.from('favorites').select('book_data').eq('user_id', userId);
        if (cloudFavs) {
            const uniqueFavs: any[] = [];
            const seen = new Set();
            cloudFavs.forEach(f => {
                if (f.book_data?.isbn && !seen.has(f.book_data.isbn)) {
                    seen.add(f.book_data.isbn);
                    uniqueFavs.push(f.book_data);
                }
            });
            setFavorites(uniqueFavs);
        }

        const { data: cloudHist } = await supabase.from('search_history')
            .select('book_data')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20); // Get more to allow for dedup down to 10
        if (cloudHist) {
            const uniqueHist: any[] = [];
            const seen = new Set();
            cloudHist.forEach(h => {
                if (h.book_data?.isbn && !seen.has(h.book_data.isbn)) {
                    seen.add(h.book_data.isbn);
                    uniqueHist.push(h.book_data);
                }
            });
            setHistory(uniqueHist.slice(0, 10));
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError(null);

        try {
            if (authMode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({
                    email: authEmail,
                    password: authPassword,
                });
                if (error) throw error;
                setShowAuthModal(false);
            } else {
                const { error } = await supabase.auth.signUp({
                    email: authEmail,
                    password: authPassword,
                    options: {
                        emailRedirectTo: window.location.origin
                    }
                });
                if (error) throw error;
                setAuthMode('login');
                setAuthError("Confirme seu e-mail para continuar.");
            }
        } catch (err: any) {
            setAuthError(err.message || "Erro na autenticação");
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setFavorites([]);
        setHistory([]);
        localStorage.removeItem('myink_favorites');
        localStorage.removeItem('myink_history');
    };

    const saveToHistory = async (bookData: any) => {
        if (!bookData.title || !bookData.isbn) return;

        if (user) {
            // Deduplicate: remove existing entry for same book to avoid doubles and update "last seen"
            await supabase.from('search_history').delete().eq('user_id', user.id).filter('book_data->>isbn', 'eq', bookData.isbn);
            const { error } = await supabase.from('search_history').insert({
                user_id: user.id,
                book_data: bookData
            });
            if (!error) loadFromCloud(user.id);
        } else {
            setHistory(prev => {
                const exists = prev.find(h => h.isbn === bookData.isbn || (h.title === bookData.title && h.author === bookData.author));
                if (exists) return prev;
                const newHistory = [bookData, ...prev].slice(0, 10);
                localStorage.setItem('myink_history', JSON.stringify(newHistory));
                return newHistory;
            });
        }
    };

    const deleteHistoryItem = async (e: React.MouseEvent, isbn: string) => {
        e.stopPropagation();
        if (user) {
            // In a real app we'd need the ID or a better filter, 
            // but for simple history matched by ISBN in the JSONB:
            const { error } = await supabase
                .from('search_history')
                .delete()
                .eq('user_id', user.id)
                .filter('book_data->>isbn', 'eq', isbn);

            if (!error) loadFromCloud(user.id);
        } else {
            setHistory(prev => {
                const newHistory = prev.filter(h => h.isbn !== isbn);
                localStorage.setItem('myink_history', JSON.stringify(newHistory));
                return newHistory;
            });
        }
    };

    const deleteFavoriteItem = async (e: React.MouseEvent, isbn: string) => {
        e.stopPropagation();
        if (user) {
            const { error } = await supabase
                .from('favorites')
                .delete()
                .eq('user_id', user.id)
                .filter('book_data->>isbn', 'eq', isbn);

            if (!error) loadFromCloud(user.id);
        } else {
            setFavorites(prev => {
                const newFavorites = prev.filter(f => f.isbn !== isbn);
                localStorage.setItem('myink_favorites', JSON.stringify(newFavorites));
                return newFavorites;
            });
        }
    };

    const toggleFavorite = async () => {
        if (!data || !data.isbn) return;

        if (user) {
            const exists = favorites.find(f => f.isbn === data.isbn);
            if (exists) {
                await supabase.from('favorites').delete().eq('user_id', user.id).filter('book_data->>isbn', 'eq', data.isbn);
            } else {
                await supabase.from('favorites').insert({ user_id: user.id, book_data: data });
            }
            loadFromCloud(user.id);
        } else {
            setFavorites(prev => {
                const exists = prev.find(f => f.isbn === data.isbn);
                let newFavorites;
                if (exists) {
                    newFavorites = prev.filter(f => f.isbn !== data.isbn);
                } else {
                    newFavorites = [data, ...prev];
                }
                localStorage.setItem('myink_favorites', JSON.stringify(newFavorites));
                return newFavorites;
            });
        }
    };

    // Simplified theme effect
    useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.add('dark');
            root.style.colorScheme = 'dark';
        } else {
            root.classList.remove('dark');
            root.style.colorScheme = 'light';
        }
    }, [isDark]);

    useEffect(() => {
        if (state === AppState.SUMMARY && synopsisRef.current) {
            const checkOverflow = () => {
                if (synopsisRef.current) {
                    // Check if content height exceeds the h-72 threshold (approx 288px)
                    const isOverflowing = synopsisRef.current.scrollHeight > 290;
                    setHasOverflow(isOverflowing);
                }
            };

            // Re-check after a brief moment for layout/fonts
            const timer = setTimeout(checkOverflow, 100);
            return () => clearTimeout(timer);
        }
    }, [data, isSummaryExpanded, state]);

    const handleSearch = async (e?: React.FormEvent | Event, overrideTitle?: string) => {
        console.log("handleSearch called", { overrideTitle, bookInput, searchFilters, headerSearchInput });
        if (e) e.preventDefault();

        if (!user) {
            setAuthMode('login');
            setShowAuthModal(true);
            return;
        }

        let queryToSearch = overrideTitle || headerSearchInput || bookInput;
        setLastQuery(queryToSearch);
        setHeaderSearchInput(''); // Clear header search after use
        setBookInput(''); // Clear main search too
        const activeFilters = isAdvancedSearchOpen ? searchFilters : {};

        // If advanced search is open and fields are filled, we use them
        const hasFilters = activeFilters.title || activeFilters.author || activeFilters.publisher;

        if (!queryToSearch.trim() && !hasFilters) return;

        setError(null);
        setState(AppState.LOADING);
        setIsSummaryExpanded(false);
        try {
            const results = await searchBooks(queryToSearch, activeFilters);
            console.log("Search results:", results);

            if (results.length === 0) {
                throw new Error("Não encontramos livros para essa busca.");
            }

            // Sempre mostra o grid de resultados para permitir escolha manual
            setSearchResults(results);
            setState(AppState.SEARCH_RESULTS);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Não conseguimos processar sua busca. Tente algo diferente.");
            setState(AppState.IDLE);
        }
    };

    const handleSelectFromSearch = async (book: any) => {
        setPrevState(AppState.SEARCH_RESULTS);
        setState(AppState.LOADING);
        try {
            const bookInfo = await fetchBookInfo(book.isbn || book.title);
            // Preserve the exact cover from search results
            if (book.coverUrl) {
                bookInfo.coverUrl = book.coverUrl;
            }
            setData(bookInfo);
            saveToHistory(bookInfo);
            setState(AppState.SUMMARY);
            setIsSummaryExpanded(false);
        } catch (err) {
            console.error(err);
            setError("Erro ao carregar detalhes do livro.");
            setState(AppState.IDLE);
        }
    };

    const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !data) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            if (base64) {
                const updatedData = { ...data, coverUrl: base64 };
                setData(updatedData);

                // Update history
                const savedHistory = localStorage.getItem('myink_history');
                if (savedHistory) {
                    const historyList = JSON.parse(savedHistory);
                    const index = historyList.findIndex((b: any) => b.isbn === data.isbn || b.title === data.title);
                    if (index !== -1) {
                        historyList[index].coverUrl = base64;
                        localStorage.setItem('myink_history', JSON.stringify(historyList));
                        setHistory(historyList);
                    }
                }

                // Update favorites
                const savedFavs = localStorage.getItem('myink_favorites');
                if (savedFavs) {
                    const favList = JSON.parse(savedFavs);
                    const index = favList.findIndex((b: any) => b.isbn === data.isbn || b.title === data.title);
                    if (index !== -1) {
                        favList[index].coverUrl = base64;
                        localStorage.setItem('myink_favorites', JSON.stringify(favList));
                        setFavorites(favList);
                    }
                }
            }
        };
        reader.readAsDataURL(file);
    };

    const handleForceCoverFetch = async () => {
        if (!data?.title) return;
        setIsGenerating(true);
        try {
            const result = await forceFetchCover(data.title, data.author || "", data.isbn, data.publisher);
            if (result) {
                const updatedData = {
                    ...data,
                    coverUrl: result.coverUrl || data.coverUrl,
                    publisher: result.publisher || data.publisher,
                    pages: result.pages || data.pages,
                    publishDate: result.publishDate || data.publishDate,
                    isbn: result.isbn || data.isbn,
                    language: result.language || data.language,
                    genre: result.genre || data.genre
                };
                setData(updatedData);

                // Update history
                const savedHistory = localStorage.getItem('myink_history');
                if (savedHistory) {
                    const historyList = JSON.parse(savedHistory);
                    const index = historyList.findIndex((b: any) => b.isbn === data.isbn || b.title === data.title);
                    if (index !== -1) {
                        historyList[index] = { ...historyList[index], ...result };
                        localStorage.setItem('myink_history', JSON.stringify(historyList));
                        setHistory(historyList);
                    }
                }

                // Update favorites
                const savedFavs = localStorage.getItem('myink_favorites');
                if (savedFavs) {
                    const favList = JSON.parse(savedFavs);
                    const index = favList.findIndex((b: any) => b.isbn === data.isbn || b.title === data.title);
                    if (index !== -1) {
                        favList[index] = { ...favList[index], ...result };
                        localStorage.setItem('myink_favorites', JSON.stringify(favList));
                        setFavorites(favList);
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
        setIsGenerating(false);
    };

    const handleRetrySearchCover = async (bookIdOrIsbn: string, title: string, author: string, publisher?: string) => {
        setIsGenerating(true);
        try {
            const result = await forceFetchCover(title, author || "", bookIdOrIsbn.length > 5 ? bookIdOrIsbn : null, publisher);
            if (result.coverUrl) {
                setSearchResults(prev => prev.map(book => {
                    const match = (book.id && book.id === bookIdOrIsbn) ||
                        (book.isbn && book.isbn === bookIdOrIsbn) ||
                        (book.title === title);
                    if (match) {
                        return { ...book, coverUrl: result.coverUrl };
                    }
                    return book;
                }));
            }
        } catch (err) {
            console.error(err);
        }
        setIsGenerating(false);
    };

    const handleNavClick = async (newState: AppState) => {
        if (!data) return;

        if (newState === AppState.FLASHCARDS && !data.flashcards) {
            setIsGenerating(true);
            try {
                // Se não tem análise profunda, gera baseada na sinopse
                const textForStudy = data.aiSummary || data.synopsis!;
                const cards = await fetchFlashcards(data.title!, data.author!, textForStudy);
                setData({ ...data, flashcards: cards });
            } catch (err) {
                console.error(err);
                setError("Erro ao gerar flashcards.");
            }
            setIsGenerating(false);
        }

        if (newState === AppState.QUIZ && !data.quiz) {
            setIsGenerating(true);
            try {
                const textForStudy = data.aiSummary || data.synopsis!;
                const questions = await fetchQuiz(data.title!, data.author!, textForStudy);
                setData({ ...data, quiz: questions });
            } catch (err) {
                console.error(err);
                setError("Erro ao gerar quiz.");
            }
            setIsGenerating(false);
        }

        setState(newState);
    };

    const handleDeepAnalysis = async () => {
        if (!data || !data.title) return;
        setIsAnalyzingDeeply(true);
        setError(null);
        try {
            const analysis = await fetchDeepAnalysis(data.title, data.author || "", data.synopsis || "");
            setData({
                ...data,
                aiSummary: analysis.aiSummary,
                originalTitle: analysis.originalTitle,
                publishDate: analysis.publishDate || data.publishDate
            });
            setIsSummaryExpanded(true); // Auto expand when analysis is ready
        } catch (err) {
            console.error(err);
            setError("Não conseguimos gerar a análise profunda no momento.");
        } finally {
            setIsAnalyzingDeeply(false);
        }
    };

    const handleFetchEditions = async () => {
        if (!data) return;
        setIsFetchingEditions(true);
        setSidebarView('editions');
        setEditionsPage(0);
        try {
            const results = await fetchOtherEditions(data.title!, data.author!);
            setEditions(results);
        } catch (err) {
            console.error(err);
        } finally {
            setIsFetchingEditions(false);
        }
    };

    const handleSelectEdition = async (edition: any) => {
        setSidebarView('info');
        setState(AppState.LOADING);
        try {
            const selectedData = await fetchBookInfo(edition.isbn || edition.id);
            // Fallback: if fetchBookInfo returns a placeholder or no cover, but we have one from the edition list, use it.
            const isPlaceholder = !selectedData.coverUrl || selectedData.coverUrl.includes('placehold.co') || selectedData.coverUrl.includes('image-not-available');
            if (isPlaceholder && edition.coverUrl) {
                selectedData.coverUrl = edition.coverUrl;
            }
            setData(selectedData);
            saveToHistory(selectedData);
            setState(AppState.SUMMARY);
            setIsSummaryExpanded(false);
        } catch (err) {
            console.error(err);
            setError("Erro ao carregar a edição selecionada.");
            setState(AppState.IDLE);
        }
    };

    const handleLoadFromHistory = (item: any) => {
        setData(item);
        setState(AppState.SUMMARY);
        setShowHistoryModal(false);
        setIsSummaryExpanded(false);
    };

    const handleLoadFromFavorites = (item: any) => {
        setData(item);
        setState(AppState.SUMMARY);
        setShowFavoritesModal(false);
        setIsSummaryExpanded(false);
    };

    const handleQuizComplete = (score: number) => {
        setQuizScore(score);
        setState(AppState.RESULTS);
    };

    const reset = () => {
        setState(AppState.IDLE);
        setBookInput('');
        setData(null);
        setQuizScore(null);
        setIsSummaryExpanded(false);
        setIsGenerating(false);
        setIsScannerOpen(false); // Reset scanner state
    };

    return (
        <div className="min-h-screen flex flex-col font-sans transition-colors duration-200 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
                <div className="container mx-auto px-6 h-20 flex items-center relative">
                    <div className="flex items-center gap-8">
                        <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={reset}>
                            <Logo />
                        </div>
                    </div>

                    {/* Global Header Search Centered */}
                    <form
                        onSubmit={handleSearch}
                        className="hidden lg:flex items-center absolute left-1/2 -translate-x-1/2 w-full max-w-[400px] relative group"
                    >
                        <Search className="absolute left-3 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                        <input
                            type="text"
                            value={headerSearchInput}
                            onChange={(e) => setHeaderSearchInput(e.target.value)}
                            placeholder="Nova pesquisa..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </form>

                    <div className="flex items-center gap-4 ml-auto">
                        {data && (
                            <nav className="hidden md:flex items-center space-x-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                {[
                                    { id: AppState.SUMMARY, label: 'Sobre', icon: Layout },
                                    { id: AppState.FLASHCARDS, label: 'Flashcards', icon: Layout },
                                    { id: AppState.QUIZ, label: 'Quiz', icon: HelpCircle },
                                    { id: AppState.RESULTS, label: 'Placar', icon: Trophy }
                                ].map((nav) => (
                                    <button
                                        key={nav.id}
                                        onClick={() => handleNavClick(nav.id)}
                                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${state === nav.id
                                            ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                                            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                                    >
                                        <nav.icon size={16} />
                                        {nav.label}
                                    </button>
                                ))}
                            </nav>
                        )}

                        {user && (
                            <button
                                onClick={() => setShowFavoritesModal(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 hover:text-red-500 transition-colors text-xs font-bold"
                            >
                                <Heart size={14} className="text-red-500 fill-red-500" />
                                Favoritos
                            </button>
                        )}

                        {user ? (
                            <div className="flex items-center gap-3 pl-3 border-l border-gray-200 dark:border-gray-700 ml-1">
                                <div className="flex flex-col items-end hidden sm:flex">
                                    <span className="text-[10px] font-bold text-gray-900 dark:text-white truncate max-w-[100px]">{user.email?.split('@')[0]}</span>
                                    {profile?.is_admin && (
                                        <span className="text-[8px] font-black uppercase text-blue-500 tracking-widest flex items-center gap-1">
                                            <ShieldCheck size={8} /> Admin
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={handleLogout}
                                    title="Sair"
                                    className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                                >
                                    <LogOut size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all text-xs font-bold uppercase tracking-widest"
                            >
                                <User size={14} />
                                Entrar
                            </button>
                        )}

                        {user && (
                            <button
                                onClick={() => setShowHistoryModal(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 hover:text-blue-600 transition-colors text-xs font-bold"
                            >
                                <RefreshCcw size={14} className="rotate-180" />
                                Histórico
                            </button>
                        )}

                        <button
                            onClick={() => setIsDark(!isDark)}
                            className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 hover:text-blue-600 transition-colors"
                        >
                            {isDark ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                    </div>
                </div>
            </header >

            <main className="flex-grow pt-20 pb-20 px-6 container mx-auto">
                <AnimatePresence mode="wait">
                    {state === AppState.IDLE && (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="max-w-4xl mx-auto text-center pt-8"
                        >
                            <div className="text-[10px] font-black uppercase tracking-widest text-blue-500/50 mb-4 animate-pulse">v5.2 stable (grid forced)</div>
                            <span className="inline-block px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold tracking-wide mb-6 border border-blue-100 dark:border-blue-800">
                                Refine seu pensamento crítico
                            </span>
                            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                                Qual <span className="text-blue-600 dark:text-blue-400">livro</span> deseja pesquisar?
                            </h2>
                            <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed">
                                Destile os conceitos mais profundos de qualquer obra literária em segundos
                            </p>

                            <form onSubmit={handleSearch} className="relative max-w-xl mx-auto animate-fade-in">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <Search size={20} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={bookInput}
                                        onChange={(e) => setBookInput(e.target.value)}
                                        placeholder="Título do livro ou tema..."
                                        className="w-full pl-12 pr-32 py-4 bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm text-sm"
                                        spellCheck={false}
                                        autoComplete="off"
                                    />
                                    <div className="absolute inset-y-2 right-2 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsScannerOpen(true)}
                                            className="p-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 rounded-lg transition-all border border-gray-200 dark:border-gray-700"
                                        >
                                            <Camera size={18} />
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={(!bookInput.trim() && !(isAdvancedSearchOpen && (searchFilters.title || searchFilters.author || searchFilters.publisher))) || isGenerating}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all shadow-md shadow-blue-600/20 disabled:opacity-50"
                                        >
                                            Analisar (V4.2)
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 flex justify-center">
                                    <button
                                        type="button"
                                        onClick={() => setIsAdvancedSearchOpen(!isAdvancedSearchOpen)}
                                        className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-500 transition-all flex items-center gap-2"
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${isAdvancedSearchOpen ? 'bg-blue-500' : 'bg-gray-300'} transition-colors`} />
                                        Busca Avançada
                                    </button>
                                </div>

                                <AnimatePresence>
                                    {isAdvancedSearchOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-6 p-6 bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Título</label>
                                                    <input
                                                        type="text"
                                                        value={searchFilters.title}
                                                        onChange={(e) => setSearchFilters({ ...searchFilters, title: e.target.value })}
                                                        placeholder="Ex: 1984"
                                                        className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Autor</label>
                                                    <input
                                                        type="text"
                                                        value={searchFilters.author}
                                                        onChange={(e) => setSearchFilters({ ...searchFilters, author: e.target.value })}
                                                        placeholder="Ex: George Orwell"
                                                        className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Editora</label>
                                                    <input
                                                        type="text"
                                                        value={searchFilters.publisher}
                                                        onChange={(e) => setSearchFilters({ ...searchFilters, publisher: e.target.value })}
                                                        placeholder="Ex: Companhia das Letras"
                                                        className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {error && (
                                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400 font-medium">
                                        {error}
                                    </div>
                                )}
                            </form>

                            <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[
                                    { title: 'Flashcards', desc: 'Conceitos fundamentais.', icon: Layout },
                                    { title: 'Quiz Ativo', desc: 'Avalie sua compreensão.', icon: HelpCircle },
                                    { title: 'Insights IA', desc: 'Conexões críticas profundas.', icon: Search }
                                ].map((feature, i) => (
                                    <div key={i} className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all text-left">
                                        <div className="text-blue-600 dark:text-blue-400 mb-4"><feature.icon size={24} /></div>
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {state === AppState.SEARCH_RESULTS && (
                        <motion.div
                            key="search_results"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="max-w-6xl mx-auto"
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-widest">
                                        Resultados para: <span className="text-blue-600 dark:text-blue-400">"{lastQuery}"</span>
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                        Encontramos {searchResults.length} livros relevantes.
                                        <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800 animate-pulse">
                                            IA Rerank Ativo
                                        </span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <button
                                            onClick={() => setSearchViewMode('grid')}
                                            className={`p-2 rounded-lg transition-all ${searchViewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-400'}`}
                                        >
                                            <Layout size={18} />
                                        </button>
                                        <button
                                            onClick={() => setSearchViewMode('list')}
                                            className={`p-2 rounded-lg transition-all ${searchViewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-400'}`}
                                        >
                                            <List size={18} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setState(AppState.IDLE)}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl transition-all font-bold text-xs uppercase tracking-widest border border-gray-200 dark:border-gray-700"
                                    >
                                        Voltar
                                    </button>
                                </div>
                            </div>

                            {searchViewMode === 'grid' ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                    {searchResults.map((book) => (
                                        <motion.div
                                            key={book.id || book.isbn}
                                            whileHover={{ y: -4 }}
                                            className="relative group"
                                        >
                                            <button
                                                onClick={() => handleSelectFromSearch(book)}
                                                className="w-full flex flex-col bg-white dark:bg-gray-800 rounded-3xl p-3 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all text-left"
                                            >
                                                <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-900 mb-3 shadow-md border border-gray-100 dark:border-gray-800 relative group/cover-card">
                                                    {book.coverUrl && !book.coverUrl.includes('placehold.co') ? (
                                                        <img src={book.coverUrl} className="w-full h-full object-cover" alt={book.title} referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-[8px] uppercase font-black text-gray-300 dark:text-gray-700 text-center leading-tight tracking-tighter italic">
                                                            <span>{book.title}</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRetrySearchCover(book.isbn || book.id, book.title, book.author, book.publisher);
                                                                }}
                                                                className="mt-2 p-1.5 bg-white dark:bg-gray-800 text-blue-600 rounded-full shadow-lg opacity-0 group-hover/cover-card:opacity-100 transition-all border border-gray-100 dark:border-gray-700"
                                                                title="Tentar carregar capa"
                                                            >
                                                                <RefreshCcw size={12} className={isGenerating ? 'animate-spin' : ''} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-h-[3.25rem] flex flex-col justify-start">
                                                    <h3 className="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight mb-1 group-hover:text-blue-600 transition-colors">
                                                        {book.title}
                                                    </h3>
                                                </div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">
                                                    {book.author}
                                                </p>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // This handles toggling via common favorites state
                                                    const isFav = favorites.find(f => f.isbn === book.isbn || f.title === book.title);
                                                    if (isFav) {
                                                        const newFavs = favorites.filter(f => (f.isbn !== book.isbn && f.title !== book.title));
                                                        setFavorites(newFavs);
                                                        localStorage.setItem('myink_favorites', JSON.stringify(newFavs));
                                                    } else {
                                                        const newFavs = [...favorites, book];
                                                        setFavorites(newFavs);
                                                        localStorage.setItem('myink_favorites', JSON.stringify(newFavs));
                                                    }
                                                }}
                                                className={`absolute top-5 right-5 p-2 rounded-full backdrop-blur-md transition-all shadow-sm ${favorites.find(f => f.isbn === book.isbn || f.title === book.title)
                                                    ? 'bg-red-500 text-white'
                                                    : 'bg-white/80 text-gray-400 hover:text-red-500'
                                                    }`}
                                            >
                                                <Heart size={14} className={favorites.find(f => f.isbn === book.isbn || f.title === book.title) ? 'fill-white' : ''} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4 max-w-4xl mx-auto">
                                    {searchResults.map((book) => (
                                        <motion.div
                                            key={book.id || book.isbn}
                                            whileHover={{ x: 4 }}
                                            className="relative flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group"
                                        >
                                            <button
                                                onClick={() => handleSelectFromSearch(book)}
                                                className="flex flex-grow items-center gap-6 text-left"
                                            >
                                                <div className="w-16 h-24 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-800 flex-shrink-0 relative group/list-cover">
                                                    {book.coverUrl && !book.coverUrl.includes('placehold.co') ? (
                                                        <img src={book.coverUrl} className="w-full h-full object-cover" alt={book.title} referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center p-1 text-[8px] text-gray-400 dark:text-gray-600 text-center uppercase font-black leading-tight italic">
                                                            <span className="line-clamp-3">{book.title}</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRetrySearchCover(book.isbn || book.id, book.title, book.author, book.publisher);
                                                                }}
                                                                className="mt-1 p-1 bg-white dark:bg-gray-800 text-blue-600 rounded-full shadow-lg opacity-0 group-hover/list-cover:opacity-100 transition-all"
                                                            >
                                                                <RefreshCcw size={10} className={isGenerating ? 'animate-spin' : ''} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-grow min-w-0">
                                                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 transition-colors">
                                                        {book.title}
                                                    </h3>
                                                    <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                                        {book.author}
                                                    </p>
                                                    {book.isbn && (
                                                        <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-2 uppercase font-semibold italic">ISBN: {book.isbn}</p>
                                                    )}
                                                </div>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const isFav = favorites.find(f => f.isbn === book.isbn || f.title === book.title);
                                                    if (isFav) {
                                                        const newFavs = favorites.filter(f => (f.isbn !== book.isbn && f.title !== book.title));
                                                        setFavorites(newFavs);
                                                        localStorage.setItem('myink_favorites', JSON.stringify(newFavs));
                                                    } else {
                                                        const newFavs = [...favorites, book];
                                                        setFavorites(newFavs);
                                                        localStorage.setItem('myink_favorites', JSON.stringify(newFavs));
                                                    }
                                                }}
                                                className={`p-3 rounded-2xl transition-all ${favorites.find(f => f.isbn === book.isbn || f.title === book.title)
                                                    ? 'bg-red-50 text-red-500'
                                                    : 'bg-gray-50 text-gray-300 hover:text-red-500'
                                                    }`}
                                            >
                                                <Heart size={20} className={favorites.find(f => f.isbn === book.isbn || f.title === book.title) ? 'fill-red-500' : ''} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {(state === AppState.LOADING || isGenerating) && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center min-h-[50vh] text-center"
                        >
                            <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 rounded-full animate-spin mb-6"></div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-widest">
                                {isGenerating ? 'Gerando Conteúdo' : 'Sincronizando'}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Preparando camada de conhecimento...</p>
                        </motion.div>
                    )}

                    {state === AppState.SUMMARY && data && !isGenerating && (
                        <motion.div
                            key="summary"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="max-w-5xl mx-auto animate-fade-in"
                        >
                            <div className="flex flex-col bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="px-6 md:px-8 pt-6 md:pt-8 pb-6 w-full">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700 pb-6">
                                        <div className="flex items-center gap-4">
                                            {prevState === AppState.SEARCH_RESULTS && (
                                                <button
                                                    onClick={() => {
                                                        setState(AppState.SEARCH_RESULTS);
                                                        setPrevState(null);
                                                    }}
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 rounded-xl transition-all border border-gray-100 dark:border-gray-700 mr-2"
                                                    title="Voltar para resultados"
                                                >
                                                    <ChevronRight size={20} className="rotate-180" />
                                                </button>
                                            )}
                                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight">
                                                {data.title}
                                            </h1>
                                            <button
                                                onClick={toggleFavorite}
                                                className={`p-2 rounded-full border transition-all ${favorites.find(f => f.isbn === data.isbn)
                                                    ? 'bg-red-50 border-red-200 text-red-500'
                                                    : 'bg-gray-50 border-gray-100 text-gray-400 hover:text-red-500'}`}
                                            >
                                                <Heart size={20} className={favorites.find(f => f.isbn === data.isbn) ? 'fill-red-500' : ''} />
                                            </button>
                                        </div>
                                        <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                            <button
                                                onClick={() => { setIsSummaryExpanded(false); setIsReadMore(false); }}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!isSummaryExpanded
                                                    ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                            >
                                                Sinopse
                                            </button>
                                            <button
                                                onClick={() => { data.aiSummary ? setIsSummaryExpanded(true) : handleDeepAnalysis(); setIsReadMore(false); }}
                                                disabled={isAnalyzingDeeply}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${isSummaryExpanded
                                                    ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                            >
                                                {isAnalyzingDeeply ? 'Analisando...' : 'Análise Crítica'}
                                                {!data.aiSummary && !isAnalyzingDeeply && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Amazon-Style Horizontal Metadata Bar - Refined per User Feedback */}
                                    <div className="mt-8 flex flex-col gap-4 px-4 bg-gray-50/50 dark:bg-gray-800/20 py-5 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                                        {/* Row 1: 4 items */}
                                        <div className="flex flex-wrap items-center justify-between gap-y-4 gap-x-6">
                                            {[
                                                { label: 'Autor', value: data.author, icon: User },
                                                { label: 'Ano', value: data.publishDate, icon: Calendar },
                                                { label: 'Páginas', value: data.pages, icon: BookOpen },
                                                { label: 'Idioma', value: data.language, icon: Languages }
                                            ].map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-2.5 group/meta min-w-[120px]">
                                                    <div className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm border border-gray-100 dark:border-gray-700 group-hover/meta:border-blue-400 transition-all shrink-0">
                                                        <item.icon size={18} className="text-blue-500" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500 leading-none mb-0.5">
                                                            {item.label}
                                                        </span>
                                                        <span className={`text-[12px] font-bold whitespace-nowrap ${!item.value || item.value === 'Desconhecido' ? 'text-gray-300 dark:text-gray-700 italic' : 'text-gray-900 dark:text-white'}`}>
                                                            {item.value || 'N/A'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Divider */}
                                        <div className="h-px bg-gray-100 dark:bg-gray-700/50 w-full" />

                                        {/* Row 2: 3 items */}
                                        <div className="flex flex-wrap items-center justify-start gap-y-4 gap-x-16">
                                            {[
                                                { label: 'Gênero', value: data.genre, icon: Tag },
                                                { label: 'Editora', value: data.publisher, icon: Building2 },
                                                { label: 'ISBN', value: data.isbn, icon: Hash }
                                            ].map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-2.5 group/meta min-w-[140px]">
                                                    <div className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm border border-gray-100 dark:border-gray-700 group-hover/meta:border-blue-400 transition-all shrink-0">
                                                        <item.icon size={18} className="text-blue-500" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500 leading-none mb-0.5">
                                                            {item.label}
                                                        </span>
                                                        <span className={`text-[12px] font-bold whitespace-nowrap ${!item.value || item.value === 'Desconhecido' ? 'text-gray-300 dark:text-gray-700 italic' : 'text-gray-900 dark:text-white'}`}>
                                                            {item.value || 'N/A'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col lg:flex-row gap-8 items-start px-6 md:px-8 pb-6 md:pb-8 pt-6 w-full">
                                    {/* Cover Column */}
                                    <div className="w-full lg:w-48 flex-shrink-0 flex flex-col items-center">
                                        <div className="relative group/cover w-48 h-72">
                                            <div className="w-full h-full rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 transform hover:scale-[1.02] transition-transform duration-300">
                                                {data.coverUrl && !data.coverUrl.includes('placehold.co') ? (
                                                    <img
                                                        src={data.coverUrl}
                                                        alt={data.title}
                                                        className="w-full h-full object-cover"
                                                        referrerPolicy="no-referrer"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = `https://placehold.co/400x600/1a202c/ffffff?text=${encodeURIComponent(data.title!)}`;
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center p-6 text-center text-[10px] text-gray-300 dark:text-gray-700 font-bold uppercase tracking-tighter leading-tight bg-gray-50 dark:bg-gray-900 shadow-inner italic">
                                                        {data.title}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Cover Control Overlay */}
                                            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-3 opacity-0 group-hover/cover:opacity-100 transition-all">
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="p-2.5 bg-white dark:bg-gray-800 text-blue-600 rounded-full shadow-xl border border-gray-100 dark:border-gray-700 transform hover:scale-110 transition-all"
                                                    title="Subir Capa manualmente"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={handleForceCoverFetch}
                                                    disabled={isGenerating}
                                                    className="p-2.5 bg-white dark:bg-gray-800 text-blue-600 rounded-full shadow-xl border border-gray-100 dark:border-gray-700 transform hover:scale-110 transition-all disabled:opacity-50"
                                                    title="Tentar carregar capa via IA"
                                                >
                                                    <RefreshCcw size={16} className={isGenerating ? 'animate-spin' : ''} />
                                                </button>
                                            </div>

                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleCoverUpload}
                                                accept="image/*"
                                                className="hidden"
                                            />
                                        </div>

                                        <div className="space-y-4 w-full mt-6">
                                            {sidebarView === 'editions' && (
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Edições PT-BR</span>
                                                        <button onClick={() => setSidebarView('info')} className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline">Voltar</button>
                                                    </div>

                                                    <div className="space-y-3 pr-2 min-h-[300px]">
                                                        {isFetchingEditions ? (
                                                            <div className="flex justify-center py-4">
                                                                <div className="w-4 h-4 border-2 border-gray-200 dark:border-gray-700 border-t-blue-600 rounded-full animate-spin"></div>
                                                            </div>
                                                        ) : editions.length > 0 ? (
                                                            <>
                                                                {editions.slice(editionsPage * 4, (editionsPage + 1) * 4).map((ed) => (
                                                                    <button
                                                                        key={ed.isbn}
                                                                        onClick={() => {
                                                                            handleSelectEdition(ed);
                                                                            setEditionsPage(0);
                                                                        }}
                                                                        className="w-full flex gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 hover:border-blue-400 transition-all text-left group"
                                                                    >
                                                                        <div className="w-8 h-12 rounded bg-gray-200 dark:bg-gray-700 flex-shrink-0 overflow-hidden shadow-sm">
                                                                            <img
                                                                                src={ed.coverUrl || ''}
                                                                                className="w-full h-full object-cover"
                                                                                referrerPolicy="no-referrer"
                                                                            />
                                                                        </div>
                                                                        <div className="flex-grow min-w-0">
                                                                            <h4 className="text-[10px] font-bold truncate text-gray-900 dark:text-white group-hover:text-blue-600">{ed.title}</h4>
                                                                            <p className="text-[8px] text-gray-400 uppercase font-black truncate">{ed.year || 'N/A'} • {ed.publisher}</p>
                                                                        </div>
                                                                    </button>
                                                                ))}

                                                                {editions.length > 4 && (
                                                                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                                                                        <button
                                                                            disabled={editionsPage === 0}
                                                                            onClick={() => setEditionsPage(p => p - 1)}
                                                                            className="text-[9px] font-bold uppercase tracking-widest text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                        >
                                                                            Anterior
                                                                        </button>
                                                                        <span className="text-[9px] font-black text-gray-400 uppercase opacity-50">
                                                                            {editionsPage + 1} / {Math.ceil(editions.length / 4)}
                                                                        </span>
                                                                        <button
                                                                            disabled={(editionsPage + 1) * 4 >= editions.length}
                                                                            onClick={() => setEditionsPage(p => p + 1)}
                                                                            className="text-[9px] font-bold uppercase tracking-widest text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                        >
                                                                            Próximo
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <p className="text-[10px] text-gray-400 italic text-center py-4">Nenhuma outra edição.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {sidebarView === 'info' && (
                                                <button
                                                    onClick={handleFetchEditions}
                                                    className="w-full mt-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-xl transition-all flex items-center justify-center gap-2 border border-blue-100 dark:border-blue-900/30"
                                                >
                                                    <Search size={14} />
                                                    Outras edições
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-grow text-left flex flex-col h-full self-stretch">
                                        <div className={`relative bg-white dark:bg-gray-800/40 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all duration-500 overflow-hidden ${isReadMore ? 'h-auto' : 'h-72'} ${state === AppState.SUMMARY ? 'ring-1 ring-blue-50 shadow-blue-900/5' : ''}`}>
                                            <div className="p-7 md:p-10" ref={synopsisRef}>
                                                <div className="prose dark:prose-invert max-w-none select-text">
                                                    <div className="text-[15px] md:text-[16px] text-gray-600 dark:text-gray-300 tracking-tight leading-[1.7] font-sans space-y-5">
                                                        {(() => {
                                                            const text = (isSummaryExpanded ? data.aiSummary : data.synopsis || "").replace(/\\n/g, '\n').replace(/\n\s*\n/g, '\n\n').trim();
                                                            let paras = text.split('\n\n').filter(p => p.trim());
                                                            if (paras.length === 1) paras = text.split('\n').filter(p => p.trim());
                                                            if (paras.length === 1 && text.length > 200) {
                                                                paras = text.split(/(?<=\.)(?=\s+[A-Z])/).filter(p => p.trim());
                                                                if (paras.length > 4) {
                                                                    const groups = [];
                                                                    for (let i = 0; i < paras.length; i += 2) groups.push(paras.slice(i, i + 2).join(' '));
                                                                    paras = groups;
                                                                }
                                                            }
                                                            return paras.map((para, i) => <p key={i}>{para}</p>);
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Read More Gradient Overlay - Only show if hasOverflow */}
                                            {!isReadMore && hasOverflow && (
                                                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white dark:from-gray-800 via-white/80 dark:via-gray-800/80 to-transparent flex items-end justify-center pb-6">
                                                    <button
                                                        onClick={() => setIsReadMore(true)}
                                                        className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl border border-blue-100 dark:border-blue-900/30 hover:bg-blue-50 dark:hover:bg-gray-600 transform hover:scale-105 transition-all group"
                                                    >
                                                        <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
                                                        Leia mais
                                                    </button>
                                                </div>
                                            )}

                                            {isReadMore && hasOverflow && (
                                                <div className="flex justify-center pb-8 pt-4">
                                                    <button
                                                        onClick={() => setIsReadMore(false)}
                                                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 transition-colors group"
                                                    >
                                                        <ChevronUp size={14} className="group-hover:-translate-y-0.5 transition-transform" />
                                                        Recolher
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-8 grid grid-cols-2 gap-4">
                                            <button onClick={() => handleNavClick(AppState.FLASHCARDS)} className="p-4 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl transition-all text-left">
                                                <h4 className="text-gray-900 dark:text-white font-bold text-xs uppercase mb-1">Flashcards</h4>
                                                <p className="text-gray-500 dark:text-gray-400 text-[12px]">Treinar memória.</p>
                                            </button>
                                            <button onClick={() => handleNavClick(AppState.QUIZ)} className="p-4 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-700 rounded-xl transition-all text-left">
                                                <h4 className="text-gray-900 dark:text-white font-bold text-xs uppercase mb-1">Quiz de Estudo</h4>
                                                <p className="text-gray-500 dark:text-gray-400 text-[12px]">Testar compreensão.</p>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {state === AppState.FLASHCARDS && data && data.flashcards && !isGenerating && (
                        <motion.div
                            key="flashcards"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="max-w-6xl mx-auto"
                        >
                            <div className="flex items-center gap-4 mb-10">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Deck Gerado</h3>
                                <div className="h-px bg-gray-200 dark:bg-gray-800 flex-grow"></div>
                                <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">8 Cards</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {data.flashcards.map((card) => (
                                    <FlashcardItem key={card.id} card={card} />
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {state === AppState.QUIZ && data && data.quiz && !isGenerating && (
                        <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <Quiz questions={data.quiz} onComplete={handleQuizComplete} />
                        </motion.div>
                    )}

                    {state === AppState.RESULTS && data && (
                        <motion.div
                            key="results"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="max-w-md mx-auto text-center bg-white dark:bg-gray-800 p-12 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700"
                        >
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-8 text-2xl">🏆</div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Treino Concluído!</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Sua pontuação final no quiz:</p>

                            <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-10">
                                {quizScore}<span className="text-xl text-gray-300 dark:text-gray-600 ml-2">/ 10</span>
                            </div>

                            <button
                                onClick={reset}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-all"
                            >
                                Nova Pesquisa
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>


            </main>

            <footer className="py-2 border-t border-gray-200 dark:border-gray-800 text-center">
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.4em]">
                    myInk • Intelligence System
                </p>
            </footer>

            {/* Modal History */}
            {
                showHistoryModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div onClick={() => setShowHistoryModal(false)} className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col relative z-50 border border-gray-200 dark:border-gray-700"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <h3 className="text-lg font-bold">Histórico Recente</h3>
                                <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white">✕</button>
                            </div>

                            <div className="overflow-y-auto p-4 space-y-2">
                                {history.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400 text-sm">Nenhuma pesquisa salva ainda.</div>
                                ) : history.map((item, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleLoadFromHistory(item)}
                                        className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900/50 border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all text-left group"
                                    >
                                        <div className="w-10 h-14 rounded bg-gray-100 dark:bg-gray-700 flex-shrink-0 overflow-hidden">
                                            <img src={item.coverUrl} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-grow overflow-hidden">
                                            <h4 className="text-sm font-bold truncate group-hover:text-blue-600 transition-colors">{item.title}</h4>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold">{item.author}</p>
                                        </div>
                                        <button
                                            onClick={(e) => deleteHistoryItem(e, item.isbn)}
                                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            title="Remover do histórico"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-600 transition-all ml-1" />
                                    </button>
                                ))}
                            </div>

                            {history.length > 0 && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
                                    <button
                                        onClick={() => { setHistory([]); localStorage.removeItem('myink_history'); }}
                                        className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline w-full text-center"
                                    >
                                        Limpar Histórico
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )
            }

            {/* Modal Favorites */}
            {
                showFavoritesModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div onClick={() => setShowFavoritesModal(false)} className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col relative z-50 border border-gray-200 dark:border-gray-700"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Heart size={18} className="text-red-500 fill-red-500" />
                                    Seus Favoritos
                                </h3>
                                <button onClick={() => setShowFavoritesModal(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white">✕</button>
                            </div>

                            <div className="overflow-y-auto p-4 space-y-2">
                                {favorites.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400 text-sm italic">Nenhum livro favoritado ainda.</div>
                                ) : favorites.map((item, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleLoadFromFavorites(item)}
                                        className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-red-50/30 dark:hover:bg-red-900/10 border border-transparent hover:border-red-100 dark:hover:border-red-900/30 transition-all text-left group"
                                    >
                                        <div className="w-10 h-14 rounded bg-gray-100 dark:bg-gray-700 flex-shrink-0 overflow-hidden shadow-sm">
                                            <img src={item.coverUrl} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-grow overflow-hidden">
                                            <h4 className="text-sm font-bold truncate group-hover:text-red-600 transition-colors">{item.title}</h4>
                                            <p className="text-[10px] text-gray-400 uppercase font-black">{item.author}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => deleteFavoriteItem(e, item.isbn)}
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Remover dos favoritos"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <Heart size={14} className="text-red-400 fill-red-400" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )
            }

            {
                isScannerOpen && (
                    <BarcodeScanner
                        onScanSuccess={(text) => {
                            setBookInput(text);
                            setIsScannerOpen(false);
                            handleSearch(new Event('submit') as any, text);
                        }}
                        onClose={() => setIsScannerOpen(false)}
                    />
                )
            }
            {/* Modal Auth */}
            {
                showAuthModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <div onClick={() => setShowAuthModal(false)} className="absolute inset-0 bg-gray-950/60 backdrop-blur-md" />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col relative z-50 border border-gray-200 dark:border-gray-700 p-8"
                        >
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-800">
                                    <User size={32} className="text-blue-500" />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                                    {authMode === 'login' ? 'Bem-vindo de volta' : 'Criar Conta'}
                                </h3>
                                <p className="text-sm text-gray-400">
                                    {authMode === 'login' ? 'Entre para sincronizar seus livros na nuvem.' : 'Cadastre-se para nunca perder seus favoritos.'}
                                </p>
                            </div>

                            <form onSubmit={handleAuth} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">E-mail</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="email"
                                            value={authEmail}
                                            onChange={(e) => setAuthEmail(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold"
                                            placeholder="seu@email.com"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Senha</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="password"
                                            value={authPassword}
                                            onChange={(e) => setAuthPassword(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                </div>

                                {authError && (
                                    <p className="text-xs text-red-500 text-center font-bold bg-red-50 dark:bg-red-900/20 py-2 rounded-xl">
                                        {authError}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={authLoading}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-500/20 font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {authLoading ? (
                                        <RefreshCcw size={16} className="animate-spin" />
                                    ) : (
                                        <>
                                            {authMode === 'login' ? 'Entrar' : 'Cadastrar'}
                                            <ChevronRight size={16} />
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-8 text-center pt-6 border-t border-gray-50 dark:border-gray-700">
                                <p className="text-xs text-gray-400 font-bold">
                                    {authMode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}
                                    <button
                                        onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                                        className="ml-2 text-blue-500 hover:underline"
                                    >
                                        {authMode === 'login' ? 'Criar agora' : 'Fazer login'}
                                    </button>
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )
            }
        </div >
    );
};

export default App;

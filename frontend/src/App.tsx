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
    const [summaryTab, setSummaryTab] = useState<'synopsis' | 'analysis' | 'notes' | 'details'>('synopsis');
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
                    // Check if content height exceeds the h-64 threshold (approx 256px) - lowered threshold to ensure it catches more cases
                    const isOverflowing = synopsisRef.current.scrollHeight > 260;
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
        <div className={`flex h-screen w-full font-sans antialiased overflow-hidden ${isDark ? 'dark' : 'light'} bg-background-light dark:bg-background-dark text-slate-900 dark:text-white transition-colors duration-300`}>
            {/* SIDEBAR */}
            <aside className="w-64 bg-white dark:bg-surface-dark border-r border-slate-200 dark:border-surface-input/30 shrink-0 hidden lg:flex flex-col justify-between shadow-sm transition-colors">
                <div className="flex flex-col gap-8 p-6">
                    {/* Brand */}
                    <div className="flex items-center gap-3 cursor-pointer" onClick={reset}>
                        <div className="flex items-center justify-center size-10 rounded-xl bg-primary/20 text-primary">
                            <span className="material-symbols-outlined filled">local_library</span>
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-slate-900 dark:text-white text-lg font-bold leading-none tracking-tight">MYINK</h1>
                            <p className="text-slate-500 dark:text-text-secondary text-xs font-medium">Reading Guide</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex flex-col gap-2">
                        <button
                            onClick={() => setState(AppState.IDLE)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${state === AppState.IDLE ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-600 dark:text-text-secondary hover:bg-slate-50 dark:hover:bg-surface-input/50 hover:text-primary dark:hover:text-white'}`}
                        >
                            <span className={`material-symbols-outlined text-[20px] ${state === AppState.IDLE ? 'filled' : ''}`}>dashboard</span>
                            <p className="text-sm font-semibold tracking-tight">Dashboard</p>
                        </button>
                        <button
                            onClick={() => { setState(AppState.SEARCH_RESULTS); setSearchResults([]); }}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${state === AppState.SEARCH_RESULTS ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-600 dark:text-text-secondary hover:bg-slate-50 dark:hover:bg-surface-input/50 hover:text-primary dark:hover:text-white'}`}
                        >
                            <span className={`material-symbols-outlined text-[20px] ${state === AppState.SEARCH_RESULTS ? 'filled' : ''}`}>explore</span>
                            <p className="text-sm font-semibold tracking-tight">Explorar</p>
                        </button>
                        <button
                            onClick={() => setShowFavoritesModal(true)}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 dark:text-text-secondary hover:bg-slate-50 dark:hover:bg-surface-input/50 hover:text-primary dark:hover:text-white transition-colors group"
                        >
                            <span className="material-symbols-outlined text-[20px]">favorite</span>
                            <p className="text-sm font-medium">Favoritos</p>
                        </button>
                        <button
                            onClick={() => setShowHistoryModal(true)}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 dark:text-text-secondary hover:bg-slate-50 dark:hover:bg-surface-input/50 hover:text-primary dark:hover:text-white transition-colors group"
                        >
                            <span className="material-symbols-outlined text-[20px]">history</span>
                            <p className="text-sm font-medium">Histórico</p>
                        </button>
                    </nav>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-surface-input/30 flex flex-col gap-4">
                    <button
                        onClick={() => setIsDark(!isDark)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 dark:text-text-secondary hover:bg-slate-50 dark:hover:bg-surface-input/50 hover:text-primary dark:hover:text-white transition-colors group"
                    >
                        <span className="material-symbols-outlined text-[20px] transition-transform duration-500">{isDark ? 'light_mode' : 'dark_mode'}</span>
                        <p className="text-sm font-medium">{isDark ? 'Light' : 'Dark'}</p>
                    </button>
                    {user ? (
                        <div className="flex items-center gap-3 px-2">
                            <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 ring-2 ring-primary/20 border-2 border-white dark:border-surface-dark shadow-sm" style={{ backgroundImage: `url(${user.user_metadata?.avatar_url || 'https://lh3.googleusercontent.com/a/default-user'})` }}></div>
                            <div className="flex flex-col overflow-hidden">
                                <p className="text-slate-900 dark:text-white text-xs font-bold truncate">{user.email?.split('@')[0]}</p>
                                <button onClick={handleLogout} className="text-primary text-[10px] font-bold uppercase tracking-wider text-left hover:underline">Sair</button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all group"
                        >
                            <span className="material-symbols-outlined text-[20px] filled">account_circle</span>
                            <p className="text-sm font-bold">Entrar</p>
                        </button>
                    )}
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* DYNAMIC HEADER */}
                <header className="flex items-center justify-between gap-6 px-8 py-5 bg-white/80 dark:bg-background-dark/95 backdrop-blur-md z-20 sticky top-0 border-b border-slate-100 dark:border-surface-input/30">
                    <div className="flex-1">
                        <h2 className="text-slate-900 dark:text-white text-xl font-black tracking-tight leading-none uppercase">
                            {state === AppState.IDLE && (user ? `Painel` : 'Bem-vindo')}
                            {state === AppState.SEARCH_RESULTS && 'Explorar'}
                            {state === AppState.SUMMARY && 'Resumo do Livro'}
                        </h2>
                    </div>

                    {/* Header Controls: Search & Scanner */}
                    <div className="flex items-center gap-4">
                        <form onSubmit={(e) => handleSearch(e, headerSearchInput)} className="relative group hidden sm:block">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[20px] group-focus-within:text-primary transition-colors">search</span>
                            <input
                                type="text"
                                value={headerSearchInput}
                                onChange={(e) => setHeaderSearchInput(e.target.value)}
                                className="w-full min-w-[320px] pl-12 pr-4 py-2.5 bg-slate-100 dark:bg-surface-input rounded-full text-sm text-slate-900 dark:text-white border-none focus:ring-2 focus:ring-primary/20 transition-all font-sans"
                                placeholder="Busca global por título, autor..."
                            />
                        </form>
                        <button
                            onClick={() => setIsScannerOpen(true)}
                            className="p-2.5 rounded-xl bg-slate-100 dark:bg-surface-input text-slate-600 dark:text-text-secondary hover:text-primary transition-all border border-transparent hover:border-primary/20"
                            title="Escanear Código de Barras"
                        >
                            <span className="material-symbols-outlined text-[20px]">barcode_scanner</span>
                        </button>
                    </div>
                </header>

                <div className="flex-grow overflow-y-auto pt-4 pb-20 px-6 container mx-auto custom-scrollbar relative z-10">
                    <AnimatePresence mode="wait">
                        {state === AppState.IDLE && (
                            <motion.div
                                key="idle"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col gap-10 max-w-6xl mx-auto"
                            >
                                {/* WELCOME & STATS */}
                                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                                    <div className="flex flex-col gap-1">
                                        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                                            Olá, {user?.email?.split('@')[0] || 'Leitor'}
                                        </h1>
                                        <p className="text-slate-500 dark:text-text-secondary font-medium italic">Você já explorou {history.length} obras incríveis.</p>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col items-center px-6 py-3 bg-white dark:bg-surface-dark border border-slate-100 dark:border-surface-input/30 rounded-2xl shadow-sm">
                                            <span className="text-primary text-xl font-black leading-none">{history.length}</span>
                                            <span className="text-slate-400 dark:text-text-secondary text-[10px] font-bold uppercase tracking-wider">Histórico</span>
                                        </div>
                                        <div className="flex flex-col items-center px-6 py-3 bg-white dark:bg-surface-dark border border-slate-100 dark:border-surface-input/30 rounded-2xl shadow-sm">
                                            <span className="text-primary text-xl font-black leading-none">{favorites.length}</span>
                                            <span className="text-slate-400 dark:text-text-secondary text-[10px] font-bold uppercase tracking-wider">Favoritos</span>
                                        </div>
                                    </div>
                                </div>

                                {/* HERO: CONTINUE READING */}
                                {history.length > 0 && (
                                    <div className="relative group overflow-hidden rounded-[32px] bg-slate-900 dark:bg-surface-dark border border-slate-800 dark:border-surface-input/30 p-8 md:p-12 shadow-2xl transition-all hover:border-primary/30">
                                        <div className="absolute top-0 right-0 size-96 bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />

                                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                                            {/* Book Cover */}
                                            <div className="w-48 aspect-[2/3] shrink-0 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 rotate-[-2deg] group-hover:rotate-0 transition-transform duration-500">
                                                <img
                                                    src={history[0].coverUrl}
                                                    alt={history[0].title}
                                                    className="w-full h-full object-cover"
                                                    referrerPolicy="no-referrer"
                                                />
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 text-center md:text-left">
                                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest mb-4">
                                                    <span className="material-symbols-outlined text-[14px] filled">auto_stories</span>
                                                    Continuar Lendo
                                                </span>
                                                <h2 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight tracking-tight uppercase">
                                                    {history[0].title}
                                                </h2>
                                                <p className="text-slate-400 text-lg font-medium mb-8 italic">
                                                    {history[0].author}
                                                </p>

                                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                                                    <button
                                                        onClick={() => handleLoadFromHistory(history[0])}
                                                        className="px-8 py-4 bg-primary hover:bg-white hover:text-slate-900 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-primary/20 flex items-center gap-3 group/btn"
                                                    >
                                                        Abrir Resumo
                                                        <span className="material-symbols-outlined text-[20px] group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
                                                    </button>
                                                    <button
                                                        className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-sm transition-all border border-white/10"
                                                        onClick={() => { setHeaderSearchInput(history[0].title); handleSearch(null as any, history[0].title); }}
                                                    >
                                                        Pesquisar Novamente
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* SEARCH PROMPT SECTION */}
                                <div className={`flex flex-col items-center text-center gap-8 ${history.length === 0 ? 'bg-white dark:bg-surface-dark border border-slate-100 dark:border-surface-input/30 p-16 rounded-[40px] shadow-sm mt-10' : 'mt-4'}`}>
                                    {history.length === 0 && (
                                        <div className="flex flex-col gap-4">
                                            <div className="size-24 bg-primary/10 text-primary rounded-[32px] flex items-center justify-center mx-auto mb-4 border border-primary/20">
                                                <span className="material-symbols-outlined text-[48px] filled">menu_book</span>
                                            </div>
                                            <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Comece sua jornada</h2>
                                            <p className="text-slate-500 dark:text-text-secondary max-w-sm mx-auto font-medium">
                                                Pesquise qualquer obra literária para gerar resumos, flashcards e quizzes personalizados com IA.
                                            </p>
                                        </div>
                                    )}

                                    <div className="w-full max-w-2xl relative group">
                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[28px] group-focus-within:text-primary transition-colors">search</span>
                                        <input
                                            type="text"
                                            value={bookInput}
                                            onChange={(e) => setBookInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any, bookInput)}
                                            placeholder="Título, autor, ISBN ou tema..."
                                            className="w-full pl-16 pr-6 py-7 bg-slate-100 dark:bg-surface-input rounded-[28px] text-xl text-slate-900 dark:text-white border-2 border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-surface-dark transition-all outline-none font-sans shadow-sm"
                                        />
                                        <button
                                            onClick={(e) => handleSearch(e as any, bookInput)}
                                            disabled={!bookInput.trim()}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-4 bg-primary hover:bg-primary-dark text-white rounded-[20px] shadow-lg shadow-primary/20 disabled:opacity-50 transition-all flex items-center gap-2"
                                        >
                                            <span className="text-sm font-bold uppercase tracking-widest hidden sm:inline">Analisar</span>
                                            <span className="material-symbols-outlined text-[20px] filled">bolt</span>
                                        </button>
                                    </div>

                                    {error && (
                                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-wider animate-shake">
                                            {error}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap items-center justify-center gap-3">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mr-2">Sugestões:</span>
                                        {['Filosofia Contemporânea', 'Tecnologia & IA', 'Grandes Clássicos', 'Produtividade Pessoal'].map(tag => (
                                            <button
                                                key={tag}
                                                onClick={() => { setBookInput(tag); handleSearch(null as any, tag); }}
                                                className="px-5 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-input/30 rounded-full text-[11px] font-bold text-slate-600 dark:text-text-secondary hover:text-primary dark:hover:text-white hover:border-primary/40 hover:shadow-md transition-all"
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {state === AppState.SEARCH_RESULTS && (
                            <motion.div
                                key="search_results"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="max-w-7xl mx-auto flex flex-col gap-8"
                            >
                                {/* HEADER & CONTROLS */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-surface-dark p-6 md:p-8 rounded-[32px] border border-slate-100 dark:border-surface-input/30 shadow-sm">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                                Resultados: <span className="text-target-primary text-primary">"{lastQuery}"</span>
                                            </h2>
                                            <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20 animate-pulse">
                                                IA Rerank Ativo
                                            </span>
                                        </div>
                                        <p className="text-slate-500 dark:text-text-secondary font-medium italic">
                                            Encontramos {searchResults.length} obras que podem te interessar.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* View Switcher */}
                                        <div className="flex bg-slate-100 dark:bg-surface-input p-1 rounded-2xl border border-slate-200 dark:border-transparent">
                                            <button
                                                onClick={() => setSearchViewMode('grid')}
                                                className={`p-2.5 rounded-xl transition-all ${searchViewMode === 'grid' ? 'bg-white dark:bg-surface-dark shadow-md text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                <Layout size={20} />
                                            </button>
                                            <button
                                                onClick={() => setSearchViewMode('list')}
                                                className={`p-2.5 rounded-xl transition-all ${searchViewMode === 'list' ? 'bg-white dark:bg-surface-dark shadow-md text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                <List size={20} />
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => setState(AppState.IDLE)}
                                            className="px-6 py-3 bg-slate-100 dark:bg-surface-input hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-text-secondary rounded-2xl transition-all font-bold text-xs uppercase tracking-widest border border-slate-200 dark:border-transparent flex items-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                                            Voltar
                                        </button>
                                    </div>
                                </div>

                                {/* CATEGORY FILTERS */}
                                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mr-2 shrink-0">Filtrar por:</span>
                                    {['Todos', 'Ficção', 'Ciência', 'História', 'Negócios', 'Filosofia', 'Tecnologia'].map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => { setBookInput(`${lastQuery} ${cat === 'Todos' ? '' : cat}`); handleSearch(null as any, `${lastQuery} ${cat === 'Todos' ? '' : cat}`); }}
                                            className="px-5 py-2 whitespace-nowrap bg-white dark:bg-surface-dark border border-slate-100 dark:border-surface-input/30 rounded-2xl text-xs font-bold text-slate-600 dark:text-text-secondary hover:text-primary dark:hover:text-white hover:border-primary/40 hover:shadow-md transition-all"
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>

                                {/* RESULTS GRID/LIST */}
                                {searchViewMode === 'grid' ? (
                                    <motion.div
                                        layout
                                        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
                                    >
                                        {searchResults.map((book, idx) => (
                                            <motion.div
                                                key={book.id || book.isbn || idx}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="relative group cursor-pointer"
                                                onClick={() => handleSelectFromSearch(book)}
                                            >
                                                <div className="relative aspect-[2/3] rounded-[24px] overflow-hidden bg-slate-200 dark:bg-surface-input shadow-lg group-hover:shadow-2xl group-hover:shadow-primary/20 transition-all duration-500 border border-slate-100 dark:border-white/5 ring-0 group-hover:ring-4 ring-primary/10">
                                                    {book.coverUrl && !book.coverUrl.includes('placehold.co') ? (
                                                        <img
                                                            src={book.coverUrl}
                                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                                            alt={book.title}
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-surface-input dark:to-surface-dark">
                                                            <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-[48px] mb-2 font-light italic">book</span>
                                                            <span className="text-[10px] font-black uppercase text-slate-400 leading-tight line-clamp-3 italic">{book.title}</span>
                                                        </div>
                                                    )}

                                                    {/* Favorite Button on Hover */}
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
                                                        className={`absolute top-4 right-4 z-20 size-10 rounded-2xl backdrop-blur-md flex items-center justify-center transition-all duration-300 transform scale-90 group-hover:scale-100 ${favorites.find(f => f.isbn === book.isbn || f.title === book.title)
                                                            ? 'bg-red-500 text-white opacity-100'
                                                            : 'bg-white/90 dark:bg-black/40 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 shadow-xl'
                                                            }`}
                                                    >
                                                        <Heart size={18} className={favorites.find(f => f.isbn === book.isbn || f.title === book.title) ? 'fill-white' : ''} />
                                                    </button>

                                                    {/* Overlay info on hover */}
                                                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                        <p className="text-[10px] font-black text-white uppercase tracking-widest line-clamp-1 italic">{book.author}</p>
                                                    </div>
                                                </div>

                                                <div className="mt-4 px-1">
                                                    <h3 className="text-sm font-black text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-primary transition-colors uppercase tracking-tight">
                                                        {book.title}
                                                    </h3>
                                                    <p className="text-[11px] font-medium text-slate-500 dark:text-text-secondary mt-1 italic">{book.author}</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {searchResults.map((book, idx) => (
                                            <motion.div
                                                key={book.id || book.isbn || idx}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.03 }}
                                                className="flex items-center gap-6 bg-white dark:bg-surface-dark p-4 rounded-[28px] border border-slate-100 dark:border-surface-input/30 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all group cursor-pointer"
                                                onClick={() => handleSelectFromSearch(book)}
                                            >
                                                <div className="w-20 aspect-[2/3] shrink-0 rounded-2xl overflow-hidden shadow-md border border-slate-100 dark:border-white/5 bg-slate-100 dark:bg-surface-input">
                                                    {book.coverUrl && !book.coverUrl.includes('placehold.co') ? (
                                                        <img src={book.coverUrl} className="w-full h-full object-cover" alt={book.title} referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center p-2 text-[8px] text-slate-400 text-center font-black uppercase italic">
                                                            {book.title}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex flex-col gap-1">
                                                            <h3 className="text-lg font-black text-slate-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors uppercase tracking-tight">
                                                                {book.title}
                                                            </h3>
                                                            <p className="text-sm font-bold text-slate-500 dark:text-text-secondary italic">
                                                                {book.author}
                                                            </p>
                                                        </div>

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
                                                                ? 'bg-red-50 dark:bg-red-500/10 text-red-500'
                                                                : 'bg-slate-50 dark:bg-surface-input text-slate-300 hover:text-red-500'
                                                                }`}
                                                        >
                                                            <Heart size={20} className={favorites.find(f => f.isbn === book.isbn || f.title === book.title) ? 'fill-red-500' : ''} />
                                                        </button>
                                                    </div>

                                                    <div className="mt-4 flex items-center gap-4">
                                                        <span className="px-3 py-1 bg-slate-100 dark:bg-surface-input/50 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-text-secondary border border-slate-100 dark:border-transparent">
                                                            {book.publisher || 'Editora Desconhecida'}
                                                        </span>
                                                        {book.isbn && (
                                                            <span className="text-[10px] font-bold text-slate-400 dark:text-text-secondary/50 uppercase italic tracking-tighter">ISBN: {book.isbn}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="hidden md:flex items-center pr-4">
                                                    <span className="material-symbols-outlined text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all">chevron_right</span>
                                                </div>
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
                                className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-8"
                            >
                                <div className="relative size-24">
                                    <div className="absolute inset-0 border-4 border-slate-100 dark:border-surface-input rounded-full" />
                                    <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(19,127,236,0.2)]" />
                                    <div className="absolute inset-5 bg-primary/10 rounded-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary text-[24px] animate-pulse">ink_pen</span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                        {isGenerating ? 'Gerando Camada de Estudo' : 'Sincronizando Conhecimento'}
                                    </h2>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] animate-fade-in italic">IA está processando metadados e estruturando o deck...</p>
                                </div>
                            </motion.div>
                        )}

                        {state === AppState.SUMMARY && data && !isGenerating && (
                            <motion.div
                                key="summary"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="max-w-7xl mx-auto flex flex-col gap-8 pb-12"
                            >
                                {/* HEADER SECTION */}
                                <div className="flex flex-col gap-6 bg-white dark:bg-surface-dark p-8 md:p-10 rounded-[40px] border border-slate-100 dark:border-surface-input/30 shadow-sm relative overflow-hidden">
                                    {/* Background Decor */}
                                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl opacity-50" />

                                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
                                        <div className="flex-1 flex flex-col gap-4">
                                            <div className="flex items-center gap-3">
                                                {prevState === AppState.SEARCH_RESULTS && (
                                                    <button
                                                        onClick={() => { setState(AppState.SEARCH_RESULTS); setPrevState(null); }}
                                                        className="size-10 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-surface-input text-slate-500 hover:text-primary transition-all border border-slate-200 dark:border-transparent"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                                                    </button>
                                                )}
                                                <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] rounded-lg border border-primary/20">Livro Selecionado</span>
                                            </div>

                                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white leading-[1.1] tracking-tight uppercase">
                                                {data.title}
                                            </h1>

                                            <div className="flex items-center gap-4 text-slate-500 dark:text-text-secondary font-bold italic">
                                                <span className="flex items-center gap-1.5 line-clamp-1">
                                                    <User size={16} className="text-primary/60" />
                                                    {data.author}
                                                </span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                                                <span className="flex items-center gap-1.5 shrink-0">
                                                    <Calendar size={16} className="text-primary/60" />
                                                    {data.publishDate}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center md:items-end gap-4 min-w-[200px]">
                                            <button
                                                onClick={toggleFavorite}
                                                className={`size-14 rounded-2xl flex items-center justify-center transition-all ${favorites.find(f => f.isbn === data.isbn)
                                                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                                    : 'bg-slate-100 dark:bg-surface-input text-slate-400 hover:text-red-500 border border-slate-200 dark:border-transparent'}`}
                                            >
                                                <Heart size={28} className={favorites.find(f => f.isbn === data.isbn) ? 'fill-white' : ''} />
                                            </button>

                                            {/* Mock Progress Bar */}
                                            <div className="w-full bg-slate-100 dark:bg-surface-input h-3 rounded-full overflow-hidden border border-slate-200 dark:border-transparent group cursor-help relative" title="Progresso de Estudo">
                                                <div className="h-full bg-primary w-[35%] rounded-full shadow-[0_0_12px_rgba(19,127,236,0.4)]" />
                                                <span className="absolute -top-6 right-0 text-[10px] font-black text-primary opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest italic">35% ESTUDADO</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* MAIN CONTENT GRID */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                                    {/* Sidebar Column (4/12) */}
                                    <div className="lg:col-span-4 flex flex-col gap-6 sticky top-28">
                                        {/* Premium Cover Card */}
                                        <div className="relative group/cover aspect-[2/3] w-full max-w-[320px] mx-auto lg:mx-0 rounded-[40px] overflow-hidden bg-slate-200 dark:bg-surface-input shadow-2xl border-4 border-white dark:border-surface-highlight">
                                            {data.coverUrl && !data.coverUrl.includes('placehold.co') ? (
                                                <img
                                                    src={data.coverUrl}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                                    alt={data.title}
                                                    referrerPolicy="no-referrer"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center p-10 text-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-surface-input dark:to-surface-dark">
                                                    <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-[80px] mb-4 italic">book</span>
                                                    <span className="text-sm font-black uppercase text-slate-400 leading-tight italic">{data.title}</span>
                                                </div>
                                            )}

                                            <div className="absolute inset-x-0 bottom-6 flex justify-center gap-3 opacity-0 group-hover/cover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover/cover:translate-y-0">
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="size-12 bg-white/95 backdrop-blur-md text-primary rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                                                    title="Upload Capa"
                                                >
                                                    <Pencil size={20} />
                                                </button>
                                                <button
                                                    onClick={handleForceCoverFetch}
                                                    className="size-12 bg-white/95 backdrop-blur-md text-primary rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                                                    title="IA Cover Fetch"
                                                >
                                                    <RefreshCcw size={20} className={isGenerating ? 'animate-spin' : ''} />
                                                </button>
                                            </div>
                                            <input type="file" ref={fileInputRef} onChange={handleCoverUpload} accept="image/*" className="hidden" />
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex flex-col gap-3">
                                            <button
                                                onClick={() => handleNavClick(AppState.FLASHCARDS)}
                                                className="w-full py-5 bg-primary hover:bg-primary/90 text-white rounded-[24px] font-black uppercase tracking-[0.15em] text-xs shadow-lg shadow-primary/20 flex items-center justify-center gap-3 group transition-all active:scale-95"
                                            >
                                                <span className="material-symbols-outlined text-[20px] group-hover:rotate-12 transition-transform">quiz</span>
                                                Praticar Flashcards
                                            </button>
                                            <button
                                                onClick={() => handleNavClick(AppState.QUIZ)}
                                                className="w-full py-5 bg-white dark:bg-surface-dark text-slate-700 dark:text-white border border-slate-200 dark:border-surface-input/50 rounded-[24px] font-black uppercase tracking-[0.15em] text-xs hover:border-primary/50 transition-all flex items-center justify-center gap-3 group active:scale-95"
                                            >
                                                <span className="material-symbols-outlined text-[20px] text-primary group-hover:scale-110 transition-transform">emoji_events</span>
                                                Iniciar Quiz
                                            </button>
                                        </div>

                                        {/* Editions Sidebar View Integration */}
                                        <div className="bg-slate-50 dark:bg-surface-input/20 p-6 rounded-[32px] border border-slate-100 dark:border-surface-input/30">
                                            {sidebarView === 'editions' ? (
                                                <div className="flex flex-col gap-4 animate-fade-in">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outras Edições</span>
                                                        <button onClick={() => setSidebarView('info')} className="size-8 flex items-center justify-center rounded-lg bg-slate-200 dark:bg-surface-input text-slate-500 hover:text-primary transition-all">
                                                            <span className="material-symbols-outlined text-[18px]">close</span>
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-col gap-3 min-h-[200px]">
                                                        {isFetchingEditions ? (
                                                            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div></div>
                                                        ) : editions.length > 0 ? (
                                                            editions.slice(editionsPage * 3, (editionsPage + 1) * 3).map((ed) => (
                                                                <button key={ed.isbn} onClick={() => { handleSelectEdition(ed); setEditionsPage(0); }} className="flex gap-4 p-3 rounded-2xl bg-white dark:bg-surface-dark border border-slate-100 dark:border-transparent hover:border-primary/40 transition-all group text-left shadow-sm">
                                                                    <div className="w-12 h-16 rounded-xl bg-slate-100 dark:bg-surface-input shrink-0 overflow-hidden shadow-sm">
                                                                        <img src={ed.coverUrl || ''} className="w-full h-full object-cover" alt={ed.title} />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                                        <h4 className="text-xs font-black truncate text-slate-900 dark:text-white uppercase tracking-tight group-hover:text-primary transition-colors">{ed.title}</h4>
                                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1 italic">{ed.year || 'N/A'} • {ed.publisher}</p>
                                                                    </div>
                                                                </button>
                                                            ))
                                                        ) : <p className="text-[11px] text-slate-400 italic text-center py-4">Nenhuma outra edição encontrada.</p>}
                                                        {editions.length > 3 && (
                                                            <div className="flex items-center justify-between pt-2">
                                                                <button disabled={editionsPage === 0} onClick={() => setEditionsPage(p => p - 1)} className="text-[10px] font-black text-primary disabled:opacity-30 uppercase tracking-widest">Ant</button>
                                                                <span className="text-[10px] font-black text-slate-400">{editionsPage + 1}/{Math.ceil(editions.length / 3)}</span>
                                                                <button disabled={(editionsPage + 1) * 3 >= editions.length} onClick={() => setEditionsPage(p => p + 1)} className="text-[10px] font-black text-primary disabled:opacity-30 uppercase tracking-widest">Próx</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleFetchEditions}
                                                    className="w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center justify-center gap-2 hover:bg-primary/5 transition-all rounded-2xl animate-fade-in"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">collections_bookmark</span>
                                                    Explorar outras edições
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Content Column (8/12) */}
                                    <div className="lg:col-span-8 flex flex-col gap-6">
                                        {/* Premium Tab System */}
                                        <div className="flex flex-col bg-white dark:bg-surface-dark rounded-[40px] border border-slate-100 dark:border-surface-input/30 shadow-sm overflow-hidden min-h-[600px]">
                                            <div className="flex items-center gap-1 p-2 bg-slate-50 dark:bg-surface-input/20 border-b border-slate-100 dark:border-surface-input/30">
                                                {[
                                                    { id: 'synopsis', label: 'Sinopse', icon: 'menu_book' },
                                                    { id: 'analysis', label: 'Análise IA', icon: 'auto_awesome' },
                                                    { id: 'notes', label: 'Meus Insights', icon: 'edit_note' },
                                                    { id: 'details', label: 'Ficha Técnica', icon: 'info' }
                                                ].map(tab => (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => {
                                                            if (tab.id === 'analysis') {
                                                                if (data.aiSummary) setSummaryTab('analysis');
                                                                else { handleDeepAnalysis(); setSummaryTab('analysis'); }
                                                            } else {
                                                                setSummaryTab(tab.id as any);
                                                            }
                                                        }}
                                                        disabled={tab.id === 'analysis' && isAnalyzingDeeply}
                                                        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[24px] text-[11px] font-black uppercase tracking-widest transition-all ${summaryTab === tab.id
                                                            ? 'bg-white dark:bg-surface-dark shadow-md text-primary ring-1 ring-slate-100 dark:ring-white/5'
                                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-text-secondary'}`}
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                                                        <span className="hidden sm:inline">{tab.label}</span>
                                                        {tab.id === 'analysis' && isAnalyzingDeeply && <div className="size-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin ml-1" />}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="p-8 md:p-10 flex-1 relative">
                                                <AnimatePresence mode="wait">
                                                    {summaryTab === 'synopsis' && (
                                                        <motion.div key="synopsis" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6">
                                                            <div className="flex items-center gap-3 mb-4">
                                                                <div className="h-8 w-1 bg-primary rounded-full" />
                                                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Visão Geral da Obra</h3>
                                                            </div>
                                                            <div className="text-base text-slate-600 dark:text-text-secondary leading-relaxed font-medium space-y-6 italic">
                                                                {(() => {
                                                                    const text = (data.synopsis || "Sinopse não disponível.").replace(/\\n/g, '\n').replace(/\n\s*\n/g, '\n\n').trim();
                                                                    let paras = text.split('\n\n').filter(p => p.trim());
                                                                    if (paras.length === 1) paras = text.split('\n').filter(p => p.trim());
                                                                    return paras.map((para, i) => <p key={i}>{para}</p>);
                                                                })()}
                                                            </div>
                                                        </motion.div>
                                                    )}

                                                    {summaryTab === 'analysis' && (
                                                        <motion.div key="analysis" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-8 w-1 bg-primary rounded-full" />
                                                                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Análise Crítica IA</h3>
                                                                </div>
                                                                {isAnalyzingDeeply && <span className="text-[10px] font-black text-primary animate-pulse tracking-widest">PROCESSANDO CAMADAS...</span>}
                                                            </div>
                                                            <div className="text-base text-slate-600 dark:text-text-secondary leading-relaxed font-medium space-y-6 italic">
                                                                {data.aiSummary ? (() => {
                                                                    const text = data.aiSummary.replace(/\\n/g, '\n').replace(/\n\s*\n/g, '\n\n').trim();
                                                                    let paras = text.split('\n\n').filter(p => p.trim());
                                                                    return paras.map((para, i) => <p key={i}>{para}</p>);
                                                                })() : (
                                                                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                                                                        <div className="size-20 bg-primary/5 rounded-full flex items-center justify-center">
                                                                            <span className="material-symbols-outlined text-primary text-[40px] animate-pulse">auto_awesome</span>
                                                                        </div>
                                                                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest text-center">Nenhuma análise gerada ainda.<br /><span className="text-[10px] font-bold text-primary cursor-pointer hover:underline" onClick={handleDeepAnalysis}>GERAR AGORA</span></p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    )}

                                                    {summaryTab === 'notes' && (
                                                        <motion.div key="notes" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="flex flex-col items-center justify-center py-20 opacity-40">
                                                            <span className="material-symbols-outlined text-[80px] mb-4">draw</span>
                                                            <h3 className="text-lg font-black uppercase tracking-widest">Meus Insights</h3>
                                                            <p className="text-xs font-bold mt-2">Funcionalidade em desenvolvimento na V12.0</p>
                                                        </motion.div>
                                                    )}

                                                    {summaryTab === 'details' && (
                                                        <motion.div key="details" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-8">
                                                            <div className="flex items-center gap-3 mb-6">
                                                                <div className="h-8 w-1 bg-primary rounded-full" />
                                                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Ficha Técnica</h3>
                                                            </div>
                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                                                {[
                                                                    { label: 'Autor', value: data.author, icon: User },
                                                                    { label: 'Publicação', value: data.publishDate, icon: Calendar },
                                                                    { label: 'Volume', value: data.pages ? `${data.pages} páginas` : 'Desconhecido', icon: BookOpen },
                                                                    { label: 'Idioma Original', value: data.language, icon: Languages },
                                                                    { label: 'Gênero/Tag', value: data.genre, icon: Tag },
                                                                    { label: 'Selo Editorial', value: data.publisher, icon: Building2 },
                                                                    { label: 'Identificador ISBN', value: data.isbn, icon: Hash }
                                                                ].map((item, idx) => (
                                                                    <div key={idx} className="flex flex-col gap-2 p-5 bg-slate-50 dark:bg-surface-input/30 rounded-[28px] border border-slate-100 dark:border-transparent">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
                                                                            <item.icon size={16} className="text-primary/40" />
                                                                        </div>
                                                                        <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{item.value || 'INDISPONÍVEL'}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {state === AppState.FLASHCARDS && data && data.flashcards && !isGenerating && (
                            <motion.div
                                key="flashcards"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="max-w-6xl mx-auto pb-20"
                            >
                                <div className="flex items-center gap-6 mb-12 bg-white dark:bg-surface-dark p-6 rounded-[32px] border border-slate-100 dark:border-surface-input/30 shadow-sm">
                                    <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary text-[24px]">collections_bookmark</span>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">Deck de Memorização</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">IA processou {data.flashcards.length} cards exclusivos</p>
                                    </div>
                                    <button onClick={reset} className="px-6 py-3 bg-slate-100 dark:bg-surface-input text-slate-500 hover:text-primary rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Voltar</button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
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
                                className="max-w-xl mx-auto text-center bg-white dark:bg-surface-dark p-12 md:p-16 rounded-[48px] shadow-2xl border border-slate-100 dark:border-surface-input/30 relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

                                <div className="size-24 bg-primary/10 text-primary rounded-[32px] flex items-center justify-center mx-auto mb-10 text-4xl shadow-inner animate-bounce">
                                    <span className="material-symbols-outlined text-[48px]">emoji_events</span>
                                </div>

                                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tight">Desafio Concluído!</h2>
                                <p className="text-slate-500 dark:text-text-secondary font-bold uppercase tracking-[0.2em] text-[10px] mb-12 italic">Performance otimizada pela camada de IA</p>

                                <div className="flex flex-col items-center gap-2 mb-12">
                                    <div className="text-8xl font-black text-primary leading-none tracking-tighter">
                                        {quizScore}<span className="text-2xl text-slate-200 dark:text-surface-input ml-2">/ 10</span>
                                    </div>
                                    <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Pontuação Final</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-10">
                                    <div className="p-5 bg-slate-50 dark:bg-surface-input/30 rounded-3xl border border-slate-100 dark:border-transparent text-left">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Métricas</span>
                                        <span className="text-sm font-black text-slate-900 dark:text-white uppercase">Excelente!</span>
                                    </div>
                                    <div className="p-5 bg-slate-50 dark:bg-surface-input/30 rounded-3xl border border-slate-100 dark:border-transparent text-left">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</span>
                                        <span className="text-sm font-black text-slate-900 dark:text-white uppercase">Sincronizado</span>
                                    </div>
                                </div>

                                <button
                                    onClick={reset}
                                    className="w-full py-5 bg-primary hover:bg-primary/90 text-white rounded-[24px] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                                >
                                    <span className="material-symbols-outlined text-[20px]">restart_alt</span>
                                    Novo Estudo
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>

            {/* View Transition Area padding */}
            <div className="h-20 shrink-0 lg:hidden" />
        </div>
    );
};

export default App;

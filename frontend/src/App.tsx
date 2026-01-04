import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookStudyData, AppState, Flashcard, QuizQuestion, Note } from './types';
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
    const [shelfNotes, setShelfNotes] = useState<Note[]>([]);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [noteFilter, setNoteFilter] = useState<'All' | 'Note' | 'Flashcard' | 'Character' | 'Quote'>('All');

    // Leitura Ativa States
    const [sessionSeconds, setSessionSeconds] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [sessionPagesRead, setSessionPagesRead] = useState(0);
    const [quickSessionNote, setQuickSessionNote] = useState('');

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

        const savedNotes = localStorage.getItem('myink_shelf_notes');
        if (savedNotes) setShelfNotes(JSON.parse(savedNotes));
        else {
            // Mock initial notes for demonstration
            const mockNotes: Note[] = [
                {
                    id: '1',
                    bookId: 'gatsby',
                    title: 'A luz verde e seu significado',
                    type: 'Note',
                    category: 'Análise',
                    page: 152,
                    content: 'A luz verde no final do cais de Daisy representa o sonho inatingível de Gatsby e a esperança no futuro...',
                    tags: ['Simbolismo', 'Gatsby'],
                    updatedAt: new Date().toISOString()
                }
            ];
            setShelfNotes(mockNotes);
            localStorage.setItem('myink_shelf_notes', JSON.stringify(mockNotes));
        }

        // Mock Book for Active Reading Demo
        const demoBook: Partial<BookStudyData> = {
            isbn: '978-85-254-3453-1',
            title: 'O Grande Gatsby',
            author: 'F. Scott Fitzgerald',
            publisher: 'L&PM Pocket',
            pages: 218,
            coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCI5te6m579eu45ys0snCH7fz7XVxa3vIdoFVs9wOaN8FoIb6B0LZl0phQXfCK-6-t8pPyxGDmoL9TlfTThmHVRqggCq4GYay_Da7zClu8JEVLPolpaI87NSsDiSBnV29kYe6peExaatYQquyCQnN5rY-A6Gao7o_0E1bL08PPKA1RNUOweVl3bGTsd19afUm9hwUngM0m5uSipPtc_Pq0s258xKG975XoJFBg_TXzpJUtRssEpEV7WoO5XiTVOAzddXD8Vx43LYUvS'
        };

        if (!data) {
            setData(demoBook);
        }

        setIsDark(false);
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');

        return () => subscription.unsubscribe();
    }, []);

    // Timer Effect for Leitura Ativa
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerRunning) {
            interval = setInterval(() => {
                setSessionSeconds(s => s + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning]);

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
            setState(AppState.DETAILS);
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
            setState(AppState.DETAILS);
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

    const handleSelectNote = (note: Note) => {
        setSelectedNote({ ...note });
    };

    const handleSaveNote = () => {
        if (!selectedNote) return;
        const updatedNotes = shelfNotes.some(n => n.id === selectedNote.id)
            ? shelfNotes.map(n => n.id === selectedNote.id ? { ...selectedNote, updatedAt: new Date().toISOString() } : n)
            : [...shelfNotes, { ...selectedNote, updatedAt: new Date().toISOString() }];

        setShelfNotes(updatedNotes);
        localStorage.setItem('myink_shelf_notes', JSON.stringify(updatedNotes));
    };

    const handleDeleteNote = (noteId: string) => {
        const updatedNotes = shelfNotes.filter(n => n.id !== noteId);
        setShelfNotes(updatedNotes);
        localStorage.setItem('myink_shelf_notes', JSON.stringify(updatedNotes));
        if (selectedNote?.id === noteId) setSelectedNote(null);
    };

    const handleNewNote = () => {
        const newNote: Note = {
            id: Date.now().toString(),
            bookId: data?.isbn || 'unlinked',
            title: 'Nova Nota',
            type: 'Note',
            category: 'Geral',
            content: '',
            tags: [],
            updatedAt: new Date().toISOString()
        };
        setSelectedNote(newNote);
    };

    const formatTime = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const startSession = () => {
        setIsTimerRunning(true);
        // The following lines appear to be a misplaced enum definition.
        // Assuming AppState enum is defined elsewhere, these are commented out
        // to prevent syntax errors.
        // ACTIVE_READING = 'ACTIVE_READING',
        // NOTES = 'NOTES',
        // DETAILS = 'DETAILS'
    };

    const stopSession = () => {
        setIsTimerRunning(false);
        // Optionally save session data here
        setState(AppState.SHELF);
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
            <aside className="w-64 bg-white dark:bg-[#151f2b] border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between h-full z-20 shrink-0 hidden lg:flex">
                <div className="flex flex-col p-6 h-full">
                    <div className="flex flex-col mb-10">
                        <div className="flex items-center gap-2" onClick={reset}>
                            <span className="material-symbols-outlined text-primary text-3xl filled">auto_stories</span>
                            <h1 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight">MYINK</h1>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium ml-9">Seu Guia de Leitura</p>
                    </div>
                    <nav className="flex flex-col gap-2 flex-1">
                        <button
                            onClick={() => setState(AppState.IDLE)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${state === AppState.IDLE ? 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined">dashboard</span>
                            <span className="text-sm font-medium">Início</span>
                        </button>
                        <button
                            onClick={() => { setState(AppState.SEARCH_RESULTS); setSearchResults([]); }}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${state === AppState.SEARCH_RESULTS ? 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined">search</span>
                            <span className="text-sm font-medium">Explorar</span>
                        </button>
                        <button
                            onClick={() => setState(AppState.SHELF)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${state === AppState.SHELF ? 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined">library_books</span>
                            <span className="text-sm font-medium">Minha Biblioteca</span>
                        </button>
                        <button
                            onClick={() => setShowFavoritesModal(true)}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined">favorite</span>
                            <span className="text-sm font-medium">Lista de Desejos</span>
                        </button>
                        <div className="my-2 border-t border-slate-100 dark:border-slate-800"></div>
                        <button
                            onClick={() => setState(AppState.ACTIVE_READING)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${state === AppState.ACTIVE_READING ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <span className={`material-symbols-outlined ${state === AppState.ACTIVE_READING ? 'filled' : ''}`}>timer</span>
                            <span className={`text-sm ${state === AppState.ACTIVE_READING ? 'font-semibold' : 'font-medium'}`}>Leitura Ativa</span>
                        </button>
                        <button
                            onClick={() => setState(AppState.NOTES)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${state === AppState.NOTES ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <span className={`material-symbols-outlined ${state === AppState.NOTES ? 'filled' : ''}`}>edit_note</span>
                            <span className={`text-sm ${state === AppState.NOTES ? 'font-semibold' : 'font-medium'}`}>Notas e Flashcards</span>
                        </button>
                        <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors">
                            <span className="material-symbols-outlined">bar_chart</span>
                            <span className="text-sm font-medium">Estatísticas</span>
                        </button>
                        <button
                            onClick={() => setShowHistoryModal(true)}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined">history</span>
                            <span className="text-sm font-medium">Histórico</span>
                        </button>
                    </nav>
                    <div className="mt-auto">
                        <button
                            onClick={() => setIsDark(!isDark)}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors w-full text-left"
                        >
                            <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
                            <span className="text-sm font-medium">Modo {isDark ? 'Claro' : 'Escuro'}</span>
                        </button>
                        <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors w-full text-left">
                            <span className="material-symbols-outlined">settings</span>
                            <span className="text-sm font-medium">Configurações</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-background-light dark:bg-background-dark">
                {/* DYNAMIC HEADER - Hidden in NOTES view as it has its own header */}
                {state !== AppState.NOTES && (
                    <header className="bg-white/80 dark:bg-[#151f2b]/80 backdrop-blur-md sticky top-0 z-10 px-8 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-6">
                        <div className="flex items-center lg:hidden gap-2">
                            <span className="material-symbols-outlined text-primary text-2xl filled">auto_stories</span>
                            <h1 className="text-slate-900 dark:text-white font-bold">MYINK</h1>
                        </div>
                        <div className="flex-1 max-w-xl hidden md:block">
                            <label className="relative flex items-center w-full">
                                <span className="absolute left-4 text-slate-400 material-symbols-outlined">search</span>
                                <input
                                    className="form-input w-full rounded-full border-none bg-slate-100 dark:bg-slate-800 py-2.5 pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20"
                                    placeholder="Buscar título, autor ou ISBN..."
                                    type="text"
                                    value={headerSearchInput}
                                    onChange={(e) => setHeaderSearchInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any, headerSearchInput)}
                                />
                            </label>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                className="relative p-2 text-slate-500 hover:text-primary transition-colors"
                                onClick={() => setIsScannerOpen(true)}
                            >
                                <span className="material-symbols-outlined">barcode_scanner</span>
                            </button>
                            <button className="relative p-2 text-slate-500 hover:text-primary transition-colors">
                                <span className="material-symbols-outlined">notifications</span>
                                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border-2 border-white dark:border-[#151f2b]"></span>
                            </button>
                            <div className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm cursor-pointer" onClick={() => user ? handleLogout() : setShowAuthModal(true)}>
                                <img alt="Profile" className="h-full w-full object-cover" src={user?.user_metadata?.avatar_url || "https://lh3.googleusercontent.com/aida-public/AB6AXuBh_4rDeneiWH-R1cD5Qb8eQOrx-aFCF8nMgbfahXsEi3eXwhE75xwLqCvXL4AmizYCLN8maOe9FYy1IP3QB6mUMEyFFfk42Cio0xM1Nwqafeuvul8ZUS8Vxzvg-JWETYJNm_2iv7aBP5GTasCCmixwpudZGucvYOH1kPo-ZJirOSadwJUY4V4dqW2UunGUghl1qqi5SAkeBkS1aOTU9L0gaF7W_lSyUnTZnXmkMH3YZbRYJU4V4dqW2UunGUghl1qqi5SAkeBkS1aOTU9L0gaF7W_lSyUnTZnXmkMH3YZbRYJU4YaP5Jao3naRFXIKaSJ1gvRtgqnxN7"} />
                            </div>
                        </div>
                    </header>
                )}

                <div className={`flex-grow overflow-y-auto custom-scrollbar relative z-10 ${[AppState.NOTES, AppState.SHELF, AppState.SEARCH_RESULTS, AppState.DETAILS].includes(state) ? 'px-0 pb-0 h-full max-w-full' : 'pt-4 pb-20 px-6 container mx-auto'}`}>
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
                                key="explore"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="font-display text-slate-900 dark:text-white"
                            >
                                <div className="layout-container flex grow flex-col">
                                    <div className="px-4 md:px-10 lg:px-12 flex flex-1 justify-center py-5">
                                        <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
                                            <div className="mb-8 pt-4 pb-6 text-center">
                                                <h1 className="text-slate-900 dark:text-white text-3xl md:text-4xl font-black leading-tight tracking-[-0.02em]">
                                                    Explore e Encontre sua Próxima Leitura
                                                </h1>
                                                <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg font-normal leading-relaxed mt-2">
                                                    Milhões de livros ao seu alcance.
                                                </p>
                                            </div>
                                            <div className="@container mb-8">
                                                <label className="flex flex-col w-full h-12 shadow-md rounded-lg">
                                                    <div className="flex w-full flex-1 items-stretch rounded-lg h-full bg-white dark:bg-slate-800 overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 focus-within:ring-2 focus-within:ring-primary transition-all">
                                                        <div className="text-slate-400 dark:text-slate-500 flex items-center justify-center pl-4">
                                                            <span className="material-symbols-outlined text-xl">search</span>
                                                        </div>
                                                        <input
                                                            className="flex w-full min-w-0 flex-1 resize-none bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-0 h-full px-3 text-base"
                                                            placeholder="Título, autor ou ISBN..."
                                                            value={bookInput}
                                                            onChange={(e) => setBookInput(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any, bookInput)}
                                                        />
                                                        <div className="flex items-center justify-center pr-1.5">
                                                            <button
                                                                onClick={(e) => handleSearch(e as any, bookInput)}
                                                                className="flex cursor-pointer items-center justify-center rounded-md h-9 px-4 bg-primary hover:bg-blue-600 text-white text-sm font-bold transition-colors"
                                                            >
                                                                <span className="truncate">Pesquisar</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </label>
                                            </div>
                                            <div className="flex flex-wrap gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
                                                <button className="group flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-4 pr-3 hover:border-primary hover:text-primary transition-colors shadow-sm">
                                                    <span className="text-sm font-medium">Relevância</span>
                                                    <span className="material-symbols-outlined text-lg text-slate-400 group-hover:text-primary">keyboard_arrow_down</span>
                                                </button>
                                                <button className="group flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-4 pr-3 hover:border-primary hover:text-primary transition-colors shadow-sm">
                                                    <span className="text-sm font-medium">Mais recentes</span>
                                                    <span className="material-symbols-outlined text-lg text-slate-400 group-hover:text-primary">keyboard_arrow_down</span>
                                                </button>
                                                <button className="group flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-4 pr-3 hover:border-primary hover:text-primary transition-colors shadow-sm">
                                                    <span className="text-sm font-medium">Gênero: Todos</span>
                                                    <span className="material-symbols-outlined text-lg text-slate-400 group-hover:text-primary">keyboard_arrow_down</span>
                                                </button>
                                                <button className="group flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-4 pr-3 hover:border-primary hover:text-primary transition-colors shadow-sm">
                                                    <span className="text-sm font-medium">Disponibilidade</span>
                                                    <span className="material-symbols-outlined text-lg text-slate-400 group-hover:text-primary">keyboard_arrow_down</span>
                                                </button>
                                            </div>
                                            <div className="pt-6">
                                                <div className="flex items-center justify-between px-2 mb-4">
                                                    <h2 className="text-[#0d141b] dark:text-white text-xl md:text-2xl font-bold leading-tight tracking-[-0.015em]">Resultados da pesquisa</h2>
                                                    <span className="text-sm text-slate-500 font-medium">Mostrando {searchResults.length} resultados</span>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 p-2">
                                                    {searchResults.map((book, idx) => (
                                                        <div
                                                            key={book.id || idx}
                                                            className="group flex flex-col gap-3 cursor-pointer"
                                                            onClick={() => handleSelectFromSearch(book)}
                                                        >
                                                            <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                                                                <div
                                                                    className="w-full h-full bg-center bg-no-repeat bg-cover"
                                                                    style={{ backgroundImage: `url("${book.coverUrl || 'https://placehold.co/400x600?text=Sem+Capa'}")` }}
                                                                >
                                                                </div>
                                                                <div
                                                                    className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const isFav = favorites.find(f => f.isbn === book.isbn);
                                                                        const newFavs = isFav
                                                                            ? favorites.filter(f => f.isbn !== book.isbn)
                                                                            : [...favorites, book];
                                                                        setFavorites(newFavs);
                                                                        localStorage.setItem('myink_favorites', JSON.stringify(newFavs));
                                                                    }}
                                                                >
                                                                    <span className={`material-symbols-outlined text-lg block ${favorites.find(f => f.isbn === book.isbn) ? 'text-primary filled' : ''}`}>
                                                                        {favorites.find(f => f.isbn === book.isbn) ? 'bookmark' : 'bookmark_add'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h3 className="text-slate-900 dark:text-white text-base font-bold leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors">{book.title}</h3>
                                                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1 line-clamp-1">{book.author}</p>
                                                                <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                                                                    <span className="material-symbols-outlined text-sm fill-current">star</span>
                                                                    <span className="text-slate-600 dark:text-slate-300">4.5</span>
                                                                    <span className="text-slate-400 font-normal ml-1">(120)</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex justify-center mt-12 mb-12">
                                                    <button className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-primary hover:text-primary transition-all text-slate-600 dark:text-slate-300 font-medium text-sm">
                                                        <span>Carregar mais livros</span>
                                                        <span className="material-symbols-outlined text-lg">expand_more</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
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

                        {state === AppState.SHELF && (
                            <motion.div
                                key="shelf"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="font-sans text-[#0d141b] dark:text-white"
                            >
                                <div className="flex flex-1 justify-center py-5 px-4 md:px-10 lg:px-12">
                                    <div className="flex flex-col max-w-[1200px] flex-1 w-full gap-6">
                                        <div className="flex flex-col gap-6">
                                            <div className="flex flex-wrap justify-between items-end gap-4 p-4 bg-white dark:bg-[#111a22] rounded-xl shadow-sm border border-[#e7edf3] dark:border-gray-800">
                                                <div className="flex min-w-72 flex-col gap-2">
                                                    <h1 className="text-[#0d141b] dark:text-white text-3xl font-semibold leading-tight tracking-[-0.033em]">Meus Livros</h1>
                                                    <p className="text-[#4c739a] text-sm font-normal leading-normal">Gerencie sua biblioteca pessoal, acompanhe leituras e organize suas coleções.</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button className="flex items-center justify-center rounded-lg h-9 px-3 border border-[#cfdbe7] dark:border-gray-700 text-[#0d141b] dark:text-white text-sm font-medium gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                                        <span className="material-symbols-outlined text-[18px]">filter_list</span>
                                                        <span className="truncate">Filtrar</span>
                                                    </button>
                                                    <button className="flex items-center justify-center rounded-lg h-9 px-3 border border-[#cfdbe7] dark:border-gray-700 text-[#0d141b] dark:text-white text-sm font-medium gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                                        <span className="material-symbols-outlined text-[18px]">sort</span>
                                                        <span className="truncate">Ordenar</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-1">
                                                <div className="flex flex-col gap-1 rounded-xl bg-white dark:bg-[#111a22] border border-[#cfdbe7] dark:border-gray-800 p-4 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="material-symbols-outlined text-primary text-[24px]">menu_book</span>
                                                        <p className="text-[#4c739a] text-xs font-bold uppercase tracking-wider">Lendo</p>
                                                    </div>
                                                    <p className="text-[#0d141b] dark:text-white text-3xl font-bold leading-tight">3</p>
                                                </div>
                                                <div className="flex flex-col gap-1 rounded-xl bg-white dark:bg-[#111a22] border border-[#cfdbe7] dark:border-gray-800 p-4 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="material-symbols-outlined text-yellow-500 text-[24px]">bookmark</span>
                                                        <p className="text-[#4c739a] text-xs font-bold uppercase tracking-wider">Quero Ler</p>
                                                    </div>
                                                    <p className="text-[#0d141b] dark:text-white text-3xl font-bold leading-tight">12</p>
                                                </div>
                                                <div className="flex flex-col gap-1 rounded-xl bg-white dark:bg-[#111a22] border border-[#cfdbe7] dark:border-gray-800 p-4 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="material-symbols-outlined text-green-500 text-[24px]">check_circle</span>
                                                        <p className="text-[#4c739a] text-xs font-bold uppercase tracking-wider">Lidos (Ano)</p>
                                                    </div>
                                                    <p className="text-[#0d141b] dark:text-white text-3xl font-bold leading-tight">8</p>
                                                </div>
                                                <div className="flex flex-col gap-1 rounded-xl bg-white dark:bg-[#111a22] border border-[#cfdbe7] dark:border-gray-800 p-4 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="material-symbols-outlined text-purple-500 text-[24px]">rate_review</span>
                                                        <p className="text-[#4c739a] text-xs font-bold uppercase tracking-wider">Resenhas</p>
                                                    </div>
                                                    <p className="text-[#0d141b] dark:text-white text-3xl font-bold leading-tight">5</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="sticky top-[73px] z-40 bg-background-light dark:bg-background-dark pt-2">
                                            <div className="border-b border-[#cfdbe7] dark:border-gray-700 px-1 overflow-x-auto">
                                                <div className="flex gap-8 min-w-max">
                                                    <a className="flex items-center justify-center border-b-[3px] border-b-primary text-[#0d141b] dark:text-white pb-3 pt-2 px-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-t transition-colors" href="#">
                                                        <p className="text-sm font-bold leading-normal tracking-[0.015em]">Lendo Agora</p>
                                                        <span className="ml-2 bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">3</span>
                                                    </a>
                                                    <a className="flex items-center justify-center border-b-[3px] border-b-transparent text-[#4c739a] pb-3 pt-2 px-2 hover:text-primary hover:border-b-primary/30 transition-all" href="#">
                                                        <p className="text-sm font-bold leading-normal tracking-[0.015em]">Quero Ler</p>
                                                    </a>
                                                    <a className="flex items-center justify-center border-b-[3px] border-b-transparent text-[#4c739a] pb-3 pt-2 px-2 hover:text-primary hover:border-b-primary/30 transition-all" href="#">
                                                        <p className="text-sm font-bold leading-normal tracking-[0.015em]">Lidos</p>
                                                    </a>
                                                    <a className="flex items-center justify-center border-b-[3px] border-b-transparent text-[#4c739a] pb-3 pt-2 px-2 hover:text-primary hover:border-b-primary/30 transition-all" href="#">
                                                        <p className="text-sm font-bold leading-normal tracking-[0.015em]">Abandonados</p>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 pb-10">
                                            {/* Book Item: The Hobbit */}
                                            <div
                                                className="group flex flex-col sm:flex-row items-stretch gap-4 rounded-xl bg-white dark:bg-[#111a22] p-4 shadow-sm border border-[#e7edf3] dark:border-gray-800 hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer"
                                                onClick={() => {
                                                    setState(AppState.DETAILS);
                                                    setData({
                                                        title: 'O Hobbit',
                                                        author: 'J.R.R. Tolkien',
                                                        pages: 300,
                                                        coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIbjpIeJYGXR2y66KhsKFqgMCdmyk42kbLTEGXGV0eq1QZSvs2bjxx3F-O--TyYXN05zmb_0gzhBD5IkhzJXO2glmqx6QmnklVyFAIx2o3ieXNDtZfv6I9dINeTU8TRgwY9nybCw4ObBweEPNI0hj1hcQPoVlWX7l-bHhJ0WcXOg2qfyp0Qk4HahVaTpqR7qqs2LehWOHAUMo6dYI0YDxG-0lT_Qk3fNIPZ3rQ_iCfsBt_UaOTROvN5_if8mS6kYGxrRslWm9-iwOs',
                                                        synopsis: 'Bilbo Bolseiro vive uma vida pacata no Condado, até que o mago Gandalf e uma companhia de anões o levam em uma aventura para recuperar o tesouro guardado pelo dragão Smaug.'
                                                    });
                                                }}
                                            >
                                                <div className="w-full sm:w-[120px] shrink-0 bg-center bg-no-repeat bg-cover rounded-lg aspect-[2/3] shadow-inner" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAIbjpIeJYGXR2y66KhsKFqgMCdmyk42kbLTEGXGV0eq1QZSvs2bjxx3F-O--TyYXN05zmb_0gzhBD5IkhzJXO2glmqx6QmnklVyFAIx2o3ieXNDtZfv6I9dINeTU8TRgwY9nybCw4ObBweEPNI0hj1hcQPoVlWX7l-bHhJ0WcXOg2qfyp0Qk4HahVaTpqR7qqs2LehWOHAUMo6dYI0YDxG-0lT_Qk3fNIPZ3rQ_iCfsBt_UaOTROvN5_if8mS6kYGxrRslWm9-iwOs")' }}></div>
                                                <div className="flex flex-1 flex-col justify-between gap-6 py-1">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex justify-between items-start">
                                                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold px-2 py-1 rounded">Fantasia</span>
                                                            <button className="text-[#4c739a] hover:text-primary p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                                                <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                                            </button>
                                                        </div>
                                                        <h3 className="text-[#0d141b] dark:text-white text-xl font-bold leading-tight mt-1">O Hobbit</h3>
                                                        <p className="text-[#4c739a] text-sm font-medium">J.R.R. Tolkien</p>
                                                        <div className="mt-4 max-w-md">
                                                            <div className="flex justify-between text-xs font-semibold text-[#4c739a] mb-1">
                                                                <span>Progresso</span>
                                                                <span>45%</span>
                                                            </div>
                                                            <div className="h-2 w-full rounded-full bg-[#e7edf3] dark:bg-gray-700 overflow-hidden">
                                                                <div className="h-full rounded-full bg-primary" style={{ width: '45%' }}></div>
                                                            </div>
                                                            <p className="text-xs text-[#4c739a] mt-1">Página 135 de 300</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button className="flex items-center justify-center rounded-lg h-9 px-4 bg-primary text-white text-sm font-bold gap-2 hover:bg-blue-600 transition-colors shadow-sm">
                                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                                            <span>Atualizar</span>
                                                        </button>
                                                        <button className="flex items-center justify-center rounded-lg h-9 px-4 bg-[#e7edf3] dark:bg-gray-800 text-[#0d141b] dark:text-white text-sm font-medium gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                                            <span className="material-symbols-outlined text-[18px]">note_add</span>
                                                            <span>Notas</span>
                                                        </button>
                                                        <button className="flex items-center justify-center rounded-lg h-9 w-9 bg-[#e7edf3] dark:bg-gray-800 text-[#0d141b] dark:text-white hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400 transition-colors" title="Marcar como lido">
                                                            <span className="material-symbols-outlined text-[18px]">check</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Book Item: Dom Casmurro */}
                                            <div
                                                className="group flex flex-col sm:flex-row items-stretch gap-4 rounded-xl bg-white dark:bg-[#111a22] p-4 shadow-sm border border-[#e7edf3] dark:border-gray-800 hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer"
                                                onClick={() => {
                                                    setState(AppState.DETAILS);
                                                    setData({
                                                        title: 'Dom Casmurro',
                                                        author: 'Machado de Assis',
                                                        pages: 256,
                                                        coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuATcnA-T31DREBo18MzP8K5YpGIIo1hdJY-Vedr3VC6Jal4nyJ2aeWDm6ixTwf0KQLTO-7jPsnRS-gHCU3DhX51SQO5gG-MqmJd4yWB0romexp-dNoGmkxAnnrg0D4_Ftk4NUSsGeQJkSBhTuhfjKDJP7ZCcBCEWUnkaAdN-pKK7d7WsK7NZNveLjbkiWhUiFWRcUBlDkmnQaLt6EwizN1YaDmPSIFMttOuOv-8BVQdXCTeUuCGsPWTdR0vLWMUDsew8WOG8DbFSFqW',
                                                        synopsis: 'Uma das maiores obras da literatura brasileira, narrada por Bentinho, que busca atar as duas pontas da vida e restaurar na velhice a adolescência. A dúvida sobre a traição de Capitu é o fio condutor.'
                                                    });
                                                }}
                                            >
                                                <div className="w-full sm:w-[120px] shrink-0 bg-center bg-no-repeat bg-cover rounded-lg aspect-[2/3] shadow-inner" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuATcnA-T31DREBo18MzP8K5YpGIIo1hdJY-Vedr3VC6Jal4nyJ2aeWDm6ixTwf0KQLTO-7jPsnRS-gHCU3DhX51SQO5gG-MqmJd4yWB0romexp-dNoGmkxAnnrg0D4_Ftk4NUSsGeQJkSBhTuhfjKDJP7ZCcBCEWUnkaAdN-pKK7d7WsK7NZNveLjbkiWhUiFWRcUBlDkmnQaLt6EwizN1YaDmPSIFMttOuOv-8BVQdXCTeUuCGsPWTdR0vLWMUDsew8WOG8DbFSFqW")' }}></div>
                                                <div className="flex flex-1 flex-col justify-between gap-6 py-1">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex justify-between items-start">
                                                            <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-semibold px-2 py-1 rounded">Clássico Brasileiro</span>
                                                            <button className="text-[#4c739a] hover:text-primary p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                                                <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                                            </button>
                                                        </div>
                                                        <h3 className="text-[#0d141b] dark:text-white text-xl font-bold leading-tight mt-1">Dom Casmurro</h3>
                                                        <p className="text-[#4c739a] text-sm font-medium">Machado de Assis</p>
                                                        <div className="mt-4 max-w-md">
                                                            <div className="flex justify-between text-xs font-semibold text-[#4c739a] mb-1">
                                                                <span>Progresso</span>
                                                                <span>12%</span>
                                                            </div>
                                                            <div className="h-2 w-full rounded-full bg-[#e7edf3] dark:bg-gray-700 overflow-hidden">
                                                                <div className="h-full rounded-full bg-primary" style={{ width: '12%' }}></div>
                                                            </div>
                                                            <p className="text-xs text-[#4c739a] mt-1">Capítulo V</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button className="flex items-center justify-center rounded-lg h-9 px-4 bg-primary text-white text-sm font-bold gap-2 hover:bg-blue-600 transition-colors shadow-sm">
                                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                                            <span>Atualizar</span>
                                                        </button>
                                                        <button className="flex items-center justify-center rounded-lg h-9 px-4 bg-[#e7edf3] dark:bg-gray-800 text-[#0d141b] dark:text-white text-sm font-medium gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                                            <span className="material-symbols-outlined text-[18px]">note_add</span>
                                                            <span>Notas</span>
                                                        </button>
                                                        <button className="flex items-center justify-center rounded-lg h-9 w-9 bg-[#e7edf3] dark:bg-gray-800 text-[#0d141b] dark:text-white hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400 transition-colors" title="Marcar como lido">
                                                            <span className="material-symbols-outlined text-[18px]">check</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Book Item: Clean Code */}
                                            <div
                                                className="group flex flex-col sm:flex-row items-stretch gap-4 rounded-xl bg-white dark:bg-[#111a22] p-4 shadow-sm border border-[#e7edf3] dark:border-gray-800 hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer"
                                                onClick={() => {
                                                    setState(AppState.DETAILS);
                                                    setData({
                                                        title: 'Clean Code',
                                                        author: 'Robert C. Martin',
                                                        pages: 464,
                                                        coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDXrgIHLozW9x8QPNIbqD3micjyca-1rQu36AiMxXohdXva3yUr8p9dvVN6LiPoe4QwOFk3Y16NR-41L3BDbdTGUg8pXX8DRzpIGhiE0crxkDuG5ogaac1HZ8MHIgYK9yDNQ6-kDG30xuBwbo_1NmFoEKmjIu4b_zPdwEgvmRVTd7szDJOMWK2oq1w4m-IRllgf6UAcIeVTdIet2EJYLK6fuTuSAKy2tMA0es2SD5wOS7Ju0uyyijaSFLSZxGdIvR8SKmXgVaMIEBIN',
                                                        synopsis: 'Even bad code can function. But if code isn\'t clean, it can bring a development organization to its knees. Every year, countless hours and significant resources are lost because of poorly written code. But it doesn\'t have to be that way.'
                                                    });
                                                }}
                                            >
                                                <div className="w-full sm:w-[120px] shrink-0 bg-center bg-no-repeat bg-cover rounded-lg aspect-[2/3] shadow-inner" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDXrgIHLozW9x8QPNIbqD3micjyca-1rQu36AiMxXohdXva3yUr8p9dvVN6LiPoe4QwOFk3Y16NR-41L3BDbdTGUg8pXX8DRzpIGhiE0crxkDuG5ogaac1HZ8MHIgYK9yDNQ6-kDG30xuBwbo_1NmFoEKmjIu4b_zPdwEgvmRVTd7szDJOMWK2oq1w4m-IRllgf6UAcIeVTdIet2EJYLK6fuTuSAKy2tMA0es2SD5wOS7Ju0uyyijaSFLSZxGdIvR8SKmXgVaMIEBIN")' }}></div>
                                                <div className="flex flex-1 flex-col justify-between gap-6 py-1">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex justify-between items-start">
                                                            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-semibold px-2 py-1 rounded">Técnico</span>
                                                            <button className="text-[#4c739a] hover:text-primary p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                                                <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                                            </button>
                                                        </div>
                                                        <h3 className="text-[#0d141b] dark:text-white text-xl font-bold leading-tight mt-1">Clean Code</h3>
                                                        <p className="text-[#4c739a] text-sm font-medium">Robert C. Martin</p>
                                                        <div className="mt-4 max-w-md">
                                                            <div className="flex justify-between text-xs font-semibold text-[#4c739a] mb-1">
                                                                <span>Progresso</span>
                                                                <span>85%</span>
                                                            </div>
                                                            <div className="h-2 w-full rounded-full bg-[#e7edf3] dark:bg-gray-700 overflow-hidden">
                                                                <div className="h-full rounded-full bg-primary" style={{ width: '85%' }}></div>
                                                            </div>
                                                            <p className="text-xs text-[#4c739a] mt-1">Capítulo 14 - Sucessive Refinement</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button className="flex items-center justify-center rounded-lg h-9 px-4 bg-primary text-white text-sm font-bold gap-2 hover:bg-blue-600 transition-colors shadow-sm">
                                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                                            <span>Atualizar</span>
                                                        </button>
                                                        <button className="flex items-center justify-center rounded-lg h-9 px-4 bg-[#e7edf3] dark:bg-gray-800 text-[#0d141b] dark:text-white text-sm font-medium gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                                            <span className="material-symbols-outlined text-[18px]">note_add</span>
                                                            <span>Notas</span>
                                                        </button>
                                                        <button className="flex items-center justify-center rounded-lg h-9 w-9 bg-[#e7edf3] dark:bg-gray-800 text-[#0d141b] dark:text-white hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400 transition-colors" title="Marcar como lido">
                                                            <span className="material-symbols-outlined text-[18px]">check</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-dashed border-[#cfdbe7] dark:border-gray-800 text-center">
                                            <div className="bg-white dark:bg-[#111a22] p-3 rounded-full shadow-sm mb-4">
                                                <span className="material-symbols-outlined text-primary text-[32px]">auto_stories</span>
                                            </div>
                                            <h3 className="text-[#0d141b] dark:text-white text-lg font-bold">Procurando sua próxima leitura?</h3>
                                            <p className="text-[#4c739a] text-sm mt-2 max-w-md">Explore nossa comunidade e descubra livros recomendados baseados no seu gosto.</p>
                                            <button className="mt-4 flex items-center justify-center rounded-lg h-10 px-6 border border-primary/30 text-primary font-bold text-sm hover:bg-primary hover:text-white transition-all">
                                                Explorar recomendações
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}



                        {state === AppState.NOTES && (
                            <motion.div
                                key="notes"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-full flex flex-col bg-background-light dark:bg-background-dark font-sans"
                            >
                                <header className="bg-white/80 dark:bg-[#151f2b]/80 backdrop-blur-md sticky top-0 z-10 px-8 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-6 shrink-0">
                                    <div className="flex items-center lg:hidden gap-2">
                                        <span className="material-symbols-outlined text-primary text-2xl filled">auto_stories</span>
                                        <h1 className="text-slate-900 dark:text-white font-bold">MYINK</h1>
                                    </div>
                                    <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
                                        <span className="hover:text-primary cursor-pointer transition-colors" onClick={() => setState(AppState.SHELF)}>Minha Estante</span>
                                        <span className="material-symbols-outlined text-base">chevron_right</span>
                                        <span className="font-medium text-slate-900 dark:text-white">{data?.title || 'O Grande Gatsby'}</span>
                                    </div>
                                    <div className="flex-1 max-w-xl hidden lg:block">
                                        <label className="relative flex items-center w-full">
                                            <span className="absolute left-4 text-slate-400 material-symbols-outlined">search</span>
                                            <input className="form-input w-full rounded-full border-none bg-slate-100 dark:bg-slate-800 py-2.5 pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20" placeholder="Pesquisar em todo o site..." type="text" />
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button className="relative p-2 text-slate-500 hover:text-primary transition-colors">
                                            <span className="material-symbols-outlined">notifications</span>
                                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border-2 border-white dark:border-[#151f2b]"></span>
                                        </button>
                                        <div className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm cursor-pointer" onClick={() => user ? handleLogout() : setShowAuthModal(true)}>
                                            <img alt="Perfil" className="h-full w-full object-cover" src={user?.user_metadata?.avatar_url || "https://lh3.googleusercontent.com/aida-public/AB6AXuBh_4rDeneiWH-R1cD5Qb8eQOrx-aFCF8nMgbfahXsEi3eXwhE75xwLqCvXL4AmizYCLN8maOe9FYy1IP3QB6mUMEyFFfk42Cio0xM1Nwqafeuvul8ZUS8Vxzvg-JWETYJNm_2iv7aBP5GTasCCmixwpudZGucvYOH1kPo-ZJirOSadwJUY4V4dqW2UunGUghl1qqi5SAkeBkS1aOTU9L0gaF7W_lSyUnTZnXmkMH3YZbRYJU4YaP5Jao3naRFXIKaSJ1gvRtgqnxN7"} />
                                        </div>
                                    </div>
                                </header>

                                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-slate-50/50 dark:bg-[#0d141c]">
                                    {/* Notes List Column */}
                                    <div className="w-full lg:w-[400px] flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151f2b] h-full">
                                        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                                            <div className="flex gap-4">
                                                <div className="w-16 h-24 rounded shadow-md overflow-hidden shrink-0 relative group cursor-pointer">
                                                    <img alt="Book Cover" className="w-full h-full object-cover" src={data?.coverUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuCI5te6m579eu45ys0snCH7fz7XVxa3vIdoFVs9wOaN8FoIb6B0LZl0phQXfCK-6-t8pPyxGDmoL9TlfTThmHVRqggCq4GYay_Da7zClu8JEVLPolpaI87NSsDiSBnV29kYe6peExaatYQquyCQnN5rY-A6Gao7o_0E1bL08PPKA1RNUOweVl3bGTsd19afUm9hwUngM0m5uSipPtc_Pq0s258xKG975XoJFBg_TXzpJUtRssEpEV7WoO5XiTVOAzddXD8Vx43LYUvS"} />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                                                </div>
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{data?.title || 'O Grande Gatsby'}</h2>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{data?.author || 'F. Scott Fitzgerald'}</p>
                                                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                                        <div className="bg-emerald-500 h-full w-[45%]"></div>
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-1">45% Concluído</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 space-y-4">
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-slate-400 material-symbols-outlined text-lg">filter_list</span>
                                                <input className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-slate-400 text-slate-900 dark:text-white" placeholder="Buscar nas notas..." type="text" />
                                            </div>
                                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                {['All', 'Note', 'Flashcard', 'Character', 'Quote'].map((f) => (
                                                    <button
                                                        key={f}
                                                        onClick={() => setNoteFilter(f as any)}
                                                        className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${noteFilter === f ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                                    >
                                                        {f === 'All' ? 'Todas' : f === 'Note' ? 'Resumos' : f === 'Character' ? 'Personagem' : f === 'Quote' ? 'Vocabulário' : 'Flashcards'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                                            {shelfNotes.filter(n => noteFilter === 'All' || n.type === noteFilter).map((note) => (
                                                <div
                                                    key={note.id}
                                                    onClick={() => handleSelectNote(note)}
                                                    className={`group p-4 rounded-xl border cursor-pointer relative hover:shadow-sm transition-all ${selectedNote?.id === note.id ? 'bg-primary/5 border-primary/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary/50'}`}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${note.type === 'Note' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : note.type === 'Flashcard' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'}`}>
                                                            {note.type}
                                                        </span>
                                                        <span className="text-xs text-slate-400">{new Date(note.updatedAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1 truncate">{note.title}</h3>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{note.content}</p>
                                                </div>
                                            ))}
                                            {shelfNotes.length === 0 && (
                                                <div className="text-center py-10">
                                                    <p className="text-sm text-slate-400">Nenhuma nota encontrada.</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 lg:hidden">
                                            <button
                                                onClick={handleNewNote}
                                                className="w-full py-2.5 bg-primary text-white rounded-lg font-medium shadow-sm hover:bg-primary/90 flex items-center justify-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-lg">add</span>
                                                Nova Nota
                                            </button>
                                        </div>
                                    </div>

                                    {/* Editor Column */}
                                    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                                        <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151f2b] px-6 flex items-center justify-between shrink-0">
                                            <div className="flex items-center gap-3">
                                                <button className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                                    <span className="material-symbols-outlined">menu</span>
                                                </button>
                                                <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:inline">Editando nota</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {selectedNote && (
                                                    <>
                                                        <button
                                                            onClick={() => handleDeleteNote(selectedNote.id)}
                                                            className="text-slate-500 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20" title="Excluir"
                                                        >
                                                            <span className="material-symbols-outlined">delete</span>
                                                        </button>
                                                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                                        <button onClick={() => setSelectedNote(null)} className="text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                                                        <button onClick={handleSaveNote} className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-lg">save</span>
                                                            Salvar
                                                        </button>
                                                    </>
                                                )}
                                                {!selectedNote && (
                                                    <button onClick={handleNewNote} className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-lg">add</span>
                                                        Nova Nota
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-background-light dark:bg-[#0d141c]">
                                            <div className="max-w-3xl mx-auto space-y-6">
                                                {selectedNote ? (
                                                    <>
                                                        <div className="bg-white dark:bg-[#151f2b] p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                                                            <div>
                                                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Título</label>
                                                                <input
                                                                    className="w-full text-xl font-bold border-none p-0 focus:ring-0 text-slate-900 dark:text-white bg-transparent placeholder:text-slate-300"
                                                                    placeholder="Título da sua nota..."
                                                                    type="text"
                                                                    value={selectedNote.title}
                                                                    onChange={(e) => setSelectedNote({ ...selectedNote, title: e.target.value })}
                                                                />
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                                <div>
                                                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tipo</label>
                                                                    <div className="relative">
                                                                        <select
                                                                            className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5"
                                                                            value={selectedNote.type}
                                                                            onChange={(e) => setSelectedNote({ ...selectedNote, type: e.target.value as any })}
                                                                        >
                                                                            <option value="Note">Nota Livre</option>
                                                                            <option value="Flashcard">Flashcard</option>
                                                                            <option value="Character">Personagem</option>
                                                                            <option value="Quote">Citação</option>
                                                                        </select>
                                                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                                                            <span className="material-symbols-outlined text-lg">expand_more</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Categoria</label>
                                                                    <div className="relative">
                                                                        <select
                                                                            className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5"
                                                                            value={selectedNote.category}
                                                                            onChange={(e) => setSelectedNote({ ...selectedNote, category: e.target.value })}
                                                                        >
                                                                            <option>Geral</option>
                                                                            <option>Análise</option>
                                                                            <option>Personagem</option>
                                                                            <option>Vocabulário</option>
                                                                            <option>Citação</option>
                                                                        </select>
                                                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                                                            <span className="material-symbols-outlined text-lg">expand_more</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Página</label>
                                                                    <div className="relative">
                                                                        <input
                                                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5"
                                                                            placeholder="ex: 42"
                                                                            type="number"
                                                                            value={selectedNote.page}
                                                                            onChange={(e) => setSelectedNote({ ...selectedNote, page: parseInt(e.target.value) || 0 })}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="bg-white dark:bg-[#151f2b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                                                            <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center gap-1 flex-wrap">
                                                                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400 transition-colors" title="Bold"><span className="material-symbols-outlined text-lg">format_bold</span></button>
                                                                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400 transition-colors" title="Italic"><span className="material-symbols-outlined text-lg">format_italic</span></button>
                                                                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400 transition-colors" title="Underline"><span className="material-symbols-outlined text-lg">format_underlined</span></button>
                                                                <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                                                                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400 transition-colors" title="List"><span className="material-symbols-outlined text-lg">format_list_bulleted</span></button>
                                                                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400 transition-colors" title="Numbered List"><span className="material-symbols-outlined text-lg">format_list_numbered</span></button>
                                                                <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                                                                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400 transition-colors" title="Link"><span className="material-symbols-outlined text-lg">link</span></button>
                                                                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400 transition-colors" title="Image"><span className="material-symbols-outlined text-lg">image</span></button>
                                                            </div>
                                                            <div className="flex-1 p-6">
                                                                <textarea
                                                                    className="w-full h-full border-none focus:ring-0 bg-transparent text-slate-700 dark:text-slate-300 resize-none leading-relaxed"
                                                                    placeholder="Escreva sua nota aqui..."
                                                                    value={selectedNote.content}
                                                                    onChange={(e) => setSelectedNote({ ...selectedNote, content: e.target.value })}
                                                                ></textarea>
                                                            </div>
                                                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-2 flex-wrap">
                                                                <span className="text-xs font-semibold text-slate-400 uppercase mr-2">Tags:</span>
                                                                {selectedNote.tags?.map(tag => (
                                                                    <span key={tag} className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 group cursor-pointer hover:bg-blue-200 transition-colors">
                                                                        {tag}
                                                                        <button className="hover:text-blue-900"><span className="material-symbols-outlined text-[14px]">close</span></button>
                                                                    </span>
                                                                ))}
                                                                <button className="text-slate-400 hover:text-primary transition-colors flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border border-dashed border-slate-300 hover:border-primary">
                                                                    <span className="material-symbols-outlined text-[14px]">add</span> Adicionar Tag
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
                                                        <span className="material-symbols-outlined text-6xl mb-4 opacity-50">edit_note</span>
                                                        <p>Selecione uma nota ou crie uma nova para começar.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {state === AppState.DETAILS && data && (
                            <motion.div
                                key="details"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="bg-background-light dark:bg-background-dark min-h-full font-display text-slate-900 dark:text-white pb-20"
                            >
                                <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                                        {/* Left Column: Sticky Cover & Actions */}
                                        <div className="lg:col-span-4 xl:col-span-3">
                                            <div className="sticky top-24 flex flex-col gap-6">
                                                {/* Book Cover */}
                                                <div className="relative group perspective-1000 w-full max-w-xs mx-auto lg:max-w-none">
                                                    <div className="aspect-[2/3] w-full bg-slate-200 dark:bg-slate-800 rounded-lg shadow-xl overflow-hidden relative">
                                                        <div
                                                            className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                                                            style={{ backgroundImage: `url('${data.coverUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuCbVcqsIaz74uIf4lzif1Vt94TByZZZ4A-ciF_i_iDapHqAb84vNCDb1qPTo9e7n6s7s83FMfp5cFHpsBkyUpz_yous2i6dW4aaDx2oVxTM_Rq8-nLRzztNOC55dIkjXVZf3VcPof_1TRnMm9u0QEHhrRET8eSxsHjtoPsqE8rq0pNSfF9Yfbl42H7uOptkOGmj9noj_xjhQFnFzDl3sML_a0Vaxepp1R1_3R4vBHAYj6qYC8axFSnAsj0Up5gTP8s3MTGnY86OCEJ7"}')` }}
                                                        >
                                                        </div>
                                                        <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/10 pointer-events-none"></div>
                                                    </div>
                                                </div>
                                                {/* Actions */}
                                                <div className="flex flex-col gap-3">
                                                    <button
                                                        onClick={() => setState(AppState.ACTIVE_READING)}
                                                        className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-blue-600 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-primary/30 transition-all active:scale-[0.98]"
                                                    >
                                                        <span className="material-symbols-outlined">timer</span>
                                                        Iniciar Sessão de Leitura
                                                    </button>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <button
                                                            onClick={() => setState(AppState.SHELF)}
                                                            className="flex items-center justify-center gap-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary/50 text-slate-700 dark:text-slate-200 font-medium py-3 px-4 rounded-xl transition-all"
                                                        >
                                                            <span className="material-symbols-outlined">library_add</span>
                                                            Biblioteca
                                                        </button>
                                                        <button className="flex items-center justify-center gap-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary/50 text-slate-700 dark:text-slate-200 font-medium py-3 px-4 rounded-xl transition-all">
                                                            <span className="material-symbols-outlined">favorite</span>
                                                            Favorito
                                                        </button>
                                                    </div>
                                                </div>
                                                {/* Progress */}
                                                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                                    <div className="flex justify-between items-end mb-2">
                                                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Seu Progresso</span>
                                                        <span className="text-sm font-bold text-slate-900 dark:text-white">32%</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                                        <div className="bg-primary h-2 rounded-full" style={{ width: '32%' }}></div>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-2 text-right">Página 210 de {data.pages || 656}</p>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Right Column: Content */}
                                        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-8">
                                            {/* Book Header */}
                                            <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-8">
                                                {/* Chips */}
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-primary dark:bg-primary/10 dark:text-blue-300">Fantasia</span>
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Alta Fantasia</span>
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Magia</span>
                                                </div>
                                                {/* Title & Author */}
                                                <div>
                                                    <h1 className="text-4xl sm:text-5xl font-semibold text-slate-900 dark:text-white leading-tight tracking-tight mb-2">{data.title}</h1>
                                                    <a className="text-xl sm:text-2xl text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors font-medium" href="#">{data.author}</a>
                                                </div>
                                                {/* Meta Info Grid */}
                                                <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-slate-600 dark:text-slate-400 mt-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-lg">star</span>
                                                        <span className="font-bold text-slate-900 dark:text-white text-base">4.8</span>
                                                        <span className="text-slate-400">(3.450 avaliações)</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-lg">auto_stories</span>
                                                        <span>{data.pages || 656} Páginas</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-lg">calendar_month</span>
                                                        <span>Publicado em {data.publishDate || '2007'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-lg">domain</span>
                                                        <span>{data.publisher || 'Editora Arqueiro'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Tabs Navigation */}
                                            <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto hide-scrollbar">
                                                <button className="px-6 py-3 text-sm font-semibold border-b-2 border-primary text-primary whitespace-nowrap">Sinopse</button>
                                                <button className="px-6 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border-b-2 border-transparent hover:border-slate-300 transition-colors whitespace-nowrap">Minhas Anotações</button>
                                                <button className="px-6 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border-b-2 border-transparent hover:border-slate-300 transition-colors whitespace-nowrap">Avaliações</button>
                                                <button className="px-6 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border-b-2 border-transparent hover:border-slate-300 transition-colors whitespace-nowrap">Citações</button>
                                            </div>
                                            {/* Tab Content: Sinopse */}
                                            <div className="prose prose-lg dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed">
                                                <p>{data.synopsis || "Ninguém sabe ao certo quem é o herói ou o vilão neste fascinante universo criado por Patrick Rothfuss. Na verdade, essas duas figuras se concentram em Kote, um homem enigmático que se esconde sob a identidade de proprietário da hospedaria Marco do Percurso."}</p>
                                                <button className="text-primary font-semibold text-sm hover:underline mt-2 flex items-center gap-1">
                                                    Ler sinopse completa
                                                    <span className="material-symbols-outlined text-sm">expand_more</span>
                                                </button>
                                            </div>
                                            {/* Notes Section Preview */}
                                            <div className="bg-white dark:bg-[#1a2632] rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm mt-4">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-primary">edit_note</span>
                                                        Anotações Recentes
                                                    </h3>
                                                    <button className="text-sm text-primary font-medium hover:underline">Ver todas ({shelfNotes.length})</button>
                                                </div>
                                                <div className="flex gap-4 items-start mb-6">
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-primary font-bold shrink-0">
                                                        You
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="relative">
                                                            <textarea className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-xl p-4 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-primary resize-none min-h-[100px]" placeholder="O que você está pensando sobre este trecho?"></textarea>
                                                            <div className="absolute bottom-3 right-3 flex gap-2">
                                                                <button className="p-1 text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-sm">format_bold</span></button>
                                                                <button className="p-1 text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-sm">format_italic</span></button>
                                                                <button className="bg-primary hover:bg-blue-600 text-white p-1.5 rounded-lg transition-colors shadow-sm">
                                                                    <span className="material-symbols-outlined text-sm block">send</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    {shelfNotes.slice(0, 2).map((note, idx) => (
                                                        <div key={idx} className="pl-4 border-l-2 border-slate-200 dark:border-slate-700 hover:border-primary transition-colors group">
                                                            <div className="flex justify-between items-start">
                                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Pág. {note.page}</span>
                                                                <span className="text-xs text-slate-400">Há 2 dias</span>
                                                            </div>
                                                            <p className="text-slate-700 dark:text-slate-300 italic">"{note.content}"</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* Reviews Summary */}
                                            <div className="mt-4">
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Avaliações da Comunidade</h3>
                                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 lg:p-8">
                                                    <div className="flex flex-col md:flex-row gap-8 items-center">
                                                        {/* Rating Number */}
                                                        <div className="flex flex-col items-center justify-center text-center min-w-[140px]">
                                                            <span className="text-5xl font-black text-slate-900 dark:text-white">4.8</span>
                                                            <div className="flex gap-1 my-2 text-amber-400">
                                                                <span className="material-symbols-outlined filled">star</span>
                                                                <span className="material-symbols-outlined filled">star</span>
                                                                <span className="material-symbols-outlined filled">star</span>
                                                                <span className="material-symbols-outlined filled">star</span>
                                                                <span className="material-symbols-outlined filled" style={{ fontVariationSettings: "'FILL' 0.5" }}>star</span>
                                                            </div>
                                                            <span className="text-sm text-slate-500">Baseado em 3.450 reviews</span>
                                                        </div>
                                                        {/* Bars */}
                                                        <div className="flex-1 w-full max-w-md space-y-2">
                                                            {[
                                                                { stars: 5, pct: 80 },
                                                                { stars: 4, pct: 12 },
                                                                { stars: 3, pct: 5 },
                                                                { stars: 2, pct: 2 },
                                                                { stars: 1, pct: 1 }
                                                            ].map(item => (
                                                                <div key={item.stars} className="flex items-center gap-3 text-xs sm:text-sm">
                                                                    <span className="font-bold w-3 text-right">{item.stars}</span>
                                                                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-primary rounded-full" style={{ width: `${item.pct}%` }}></div>
                                                                    </div>
                                                                    <span className="text-slate-500 w-8">{item.pct}%</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {state === AppState.ACTIVE_READING && (
                            <motion.div
                                key="active-reading"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="p-4 md:p-8 max-w-6xl mx-auto w-full flex flex-col h-full"
                            >
                                <div className="mb-6">
                                    <button
                                        onClick={() => setState(AppState.SHELF)}
                                        className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-lg mr-1">arrow_back</span>
                                        Voltar para Biblioteca
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                    <div className="lg:col-span-4 flex flex-col gap-6">
                                        <div className="bg-white dark:bg-[#151f2b] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                                <span className="material-symbols-outlined text-8xl text-slate-900 dark:text-white">menu_book</span>
                                            </div>
                                            <div className="relative z-10 flex flex-col items-center text-center">
                                                <div className="w-40 aspect-[2/3] rounded-lg shadow-lg overflow-hidden bg-slate-100 mb-6 group cursor-pointer">
                                                    <img
                                                        alt="Capa do livro O Grande Gatsby"
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                        src={data?.coverUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuCI5te6m579eu45ys0snCH7fz7XVxa3vIdoFVs9wOaN8FoIb6B0LZl0phQXfCK-6-t8pPyxGDmoL9TlfTThmHVRqggCq4GYay_Da7zClu8JEVLPolpaI87NSsDiSBnV29kYe6peExaatYQquyCQnN5rY-A6Gao7o_0E1bL08PPKA1RNUOweVl3bGTsd19afUm9hwUngM0m5uSipPtc_Pq0s258xKG975XoJFBg_TXzpJUtRssEpEV7WoO5XiTVOAzddXD8Vx43LYUvS"}
                                                    />
                                                </div>
                                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{data?.title || 'O Grande Gatsby'}</h2>
                                                <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">por {data?.author || 'F. Scott Fitzgerald'}</p>
                                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-2 overflow-hidden">
                                                    <div className="bg-primary h-full rounded-full relative overflow-hidden" style={{ width: '45%' }}>
                                                        <div className="absolute inset-0 bg-white/20"></div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between w-full text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                    <span>Capítulo 4</span>
                                                    <span>45%</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-6 border border-blue-100 dark:border-blue-900/20">
                                            <h3 className="text-blue-900 dark:text-blue-100 font-bold mb-4 flex items-center gap-2">
                                                <span className="material-symbols-outlined">trending_up</span>
                                                Sessão Atual
                                            </h3>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-blue-700 dark:text-blue-300">Páginas lidas</span>
                                                    <span className="font-bold text-blue-900 dark:text-white">{sessionPagesRead}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-blue-700 dark:text-blue-300">Ritmo médio</span>
                                                    <span className="font-bold text-blue-900 dark:text-white">-- min/pág</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="lg:col-span-8 flex flex-col gap-6">
                                        <div className="bg-white dark:bg-[#151f2b] rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center min-h-[400px] relative">
                                            <div className="absolute top-6 right-6">
                                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-100 dark:border-emerald-800">
                                                    <span className={`w-2 h-2 rounded-full bg-emerald-500 ${isTimerRunning ? 'animate-pulse' : ''}`}></span>
                                                    {isTimerRunning ? 'Leitura em andamento' : 'Sessão Pausada'}
                                                </span>
                                            </div>
                                            <div className="text-center mb-12 relative">
                                                <div className="font-mono text-8xl md:text-9xl font-bold text-slate-900 dark:text-white tracking-tighter tabular-nums leading-none mb-2 select-none">
                                                    {formatTime(sessionSeconds)}
                                                </div>
                                                <p className="text-slate-400 text-sm font-semibold uppercase tracking-[0.2em]">Tempo Decorrido</p>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <button
                                                    onClick={() => setIsTimerRunning(false)}
                                                    className="group flex flex-col items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors"
                                                >
                                                    <div className="w-16 h-16 rounded-full border-2 border-slate-100 group-hover:border-amber-100 bg-white group-hover:bg-amber-50 flex items-center justify-center transition-all shadow-sm">
                                                        <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform filled">pause</span>
                                                    </div>
                                                    <span className="text-xs font-semibold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Pausar</span>
                                                </button>
                                                <button
                                                    onClick={() => setIsTimerRunning(true)}
                                                    className="group flex flex-col items-center gap-2 text-slate-400 hover:text-primary transition-colors transform scale-110"
                                                >
                                                    <div className="w-20 h-20 rounded-full bg-primary text-white shadow-lg shadow-blue-500/30 hover:bg-blue-600 hover:shadow-blue-600/40 flex items-center justify-center transition-all">
                                                        <span className="material-symbols-outlined text-4xl filled">play_arrow</span>
                                                    </div>
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Retomar</span>
                                                </button>
                                                <button
                                                    onClick={stopSession}
                                                    className="group flex flex-col items-center gap-2 text-slate-400 hover:text-red-500 transition-colors"
                                                >
                                                    <div className="w-16 h-16 rounded-full border-2 border-slate-100 group-hover:border-red-100 bg-white group-hover:bg-red-50 flex items-center justify-center transition-all shadow-sm">
                                                        <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform filled">stop</span>
                                                    </div>
                                                    <span className="text-xs font-semibold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Parar</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-white dark:bg-[#151f2b] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                                                <div>
                                                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">Registrar Progresso</h3>
                                                    <p className="text-sm text-slate-500 mb-6">Atualize onde você parou.</p>
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="relative flex-1">
                                                            <input
                                                                className="form-input w-full rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-lg font-bold text-slate-900 dark:text-white py-3 pl-4 pr-12 focus:ring-primary focus:border-primary"
                                                                placeholder="98"
                                                                type="number"
                                                                value={sessionPagesRead || ''}
                                                                onChange={(e) => setSessionPagesRead(parseInt(e.target.value) || 0)}
                                                            />
                                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">pág</span>
                                                        </div>
                                                        <div className="text-slate-400 font-medium text-sm">
                                                            de {data?.pages || 218}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button className="w-full mt-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-xl font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                                                    <span className="material-symbols-outlined text-lg">save</span>
                                                    Salvar Página
                                                </button>
                                            </div>
                                            <div className="bg-white dark:bg-[#151f2b] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                                                <h3 className="font-bold text-slate-900 dark:text-white mb-1">Notas Rápidas</h3>
                                                <p className="text-sm text-slate-500 mb-4">Insights durante a leitura.</p>
                                                <textarea
                                                    className="form-textarea w-full flex-1 rounded-xl border-slate-200 dark:border-slate-700 bg-amber-50/50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 resize-none focus:ring-amber-200 focus:border-amber-300 placeholder:text-slate-400 text-sm"
                                                    placeholder="Digite seus pensamentos aqui..."
                                                    value={quickSessionNote}
                                                    onChange={(e) => setQuickSessionNote(e.target.value)}
                                                ></textarea>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}


                    </AnimatePresence>
                </div>
            </main >

            {/* Mobile Navigation Padding */}
            < div className="h-20 shrink-0 lg:hidden" />
        </div >
    );
};

export default App;

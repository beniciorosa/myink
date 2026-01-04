
export interface Flashcard {
  id: string;
  front: string;
  back: string;
  insight: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface BookStudyData {
  title: string;
  originalTitle?: string | null;
  author: string;
  publishDate?: string;
  pages?: number;
  isbn?: string;
  genre?: string;
  coverUrl?: string | null;
  publisher?: string;
  synopsis: string;
  aiSummary?: string;
  language?: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
}

export interface BookEdition {
  id: string;
  title: string;
  author: string;
  publisher: string;
  year: string;
  isbn: string;
  coverUrl: string | null;
  language?: string;
  whyExplanation?: string;
}

export interface Note {
  id: string;
  bookId: string;
  title: string;
  type: 'Note' | 'Flashcard' | 'Character' | 'Quote';
  category: string;
  page?: number;
  content: string;
  tags: string[];
  updatedAt: string;
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  FLASHCARDS = 'FLASHCARDS',
  QUIZ = 'QUIZ',
  SUMMARY = 'SUMMARY',
  RESULTS = 'RESULTS',
  SEARCH_RESULTS = 'SEARCH_RESULTS',
  SHELF = 'SHELF'
}

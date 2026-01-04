import axios from 'axios';
import { BookStudyData, Flashcard, QuizQuestion } from '../types';

const getBaseURL = () => {
    if (import.meta.env.PROD) {
        return "/api";
    }
    const { hostname } = window.location;
    return `http://${hostname}:3001/api`;
};

const api = axios.create({
    baseURL: getBaseURL()
});

export const fetchBookInfo = async (title: string): Promise<Partial<BookStudyData>> => {
    const response = await api.post('/book-info', { title });
    return response.data;
};

export const fetchFlashcards = async (title: string, author: string, summary: string): Promise<Flashcard[]> => {
    const response = await api.post('/flashcards', { title, author, summary });
    return response.data;
};

export const fetchQuiz = async (title: string, author: string, summary: string): Promise<QuizQuestion[]> => {
    const response = await api.post('/quiz', { title, author, summary });
    return response.data;
};

export const fetchDeepAnalysis = async (title: string, author: string, synopsis: string): Promise<any> => {
    const response = await api.post('/deep-analysis', { title, author, synopsis });
    return response.data;
};

export const fetchOtherEditions = async (title: string, author: string): Promise<any> => {
    const response = await api.post('/book-editions', { title, author });
    return response.data;
};

export const ocrIsbn = async (image: string): Promise<string | null> => {
    const response = await api.post('/ocr-isbn', { image });
    return response.data.isbn;
};

export const searchBooks = async (query: string, filters?: { title?: string, author?: string, publisher?: string }): Promise<any[]> => {
    const response = await api.post('/search', { query, filters });
    return response.data;
};

export const forceFetchCover = async (title: string, author: string, isbn?: string | null, publisher?: string | null): Promise<{
    coverUrl: string | null,
    publisher?: string | null,
    pages?: number | null,
    publishDate?: string | null,
    isbn?: string | null
}> => {
    const response = await api.post('/force-cover', { title, author, isbn, publisher });
    return response.data;
};

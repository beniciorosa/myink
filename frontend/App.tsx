
import React, { useState, useEffect } from 'react';
import { BookStudyData, AppState } from './types';
import { generateBookStudyData } from './services/geminiService';
import { FlashcardItem } from './components/FlashcardItem';
import { Quiz } from './components/Quiz';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [bookInput, setBookInput] = useState('');
  const [data, setData] = useState<BookStudyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookInput.trim()) return;

    setError(null);
    setState(AppState.LOADING);
    try {
      const studyData = await generateBookStudyData(bookInput);
      setData(studyData);
      setState(AppState.FLASHCARDS);
    } catch (err) {
      console.error(err);
      setError("Não conseguimos analisar este livro. Tente um título diferente.");
      setState(AppState.IDLE);
    }
  };

  const handleQuizComplete = (score: number) => {
    setQuizScore(score);
    setState(AppState.SUMMARY);
  };

  const reset = () => {
    setState(AppState.IDLE);
    setBookInput('');
    setData(null);
    setQuizScore(null);
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-900">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-slate-200 py-4">
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div 
            className="flex items-center space-x-2 cursor-pointer" 
            onClick={reset}
          >
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Flashcard Apps</h1>
          </div>

          {state !== AppState.IDLE && state !== AppState.LOADING && (
            <nav className="flex items-center space-x-6">
              <button 
                onClick={() => setState(AppState.FLASHCARDS)}
                className={`text-sm font-semibold transition-colors ${state === AppState.FLASHCARDS ? 'text-indigo-600 underline decoration-2 underline-offset-8' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Flashcards
              </button>
              <button 
                onClick={() => setState(AppState.QUIZ)}
                className={`text-sm font-semibold transition-colors ${state === AppState.QUIZ ? 'text-indigo-600 underline decoration-2 underline-offset-8' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Quiz
              </button>
              <button 
                onClick={reset}
                className="text-sm font-semibold text-slate-500 hover:text-red-500 transition-colors"
              >
                Novo Livro
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-grow container mx-auto px-6 py-12">
        {state === AppState.IDLE && (
          <div className="max-w-4xl mx-auto text-center mt-12">
            <h2 className="text-5xl md:text-6xl font-black text-slate-900 mb-6 leading-tight">
              Domine qualquer livro com estudos guiados por <span className="text-indigo-600">IA</span>.
            </h2>
            <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto">
              Desbloqueie compreensão profunda e pensamento crítico. Digite o título de um livro para gerar insights, flashcards e quizzes instantaneamente.
            </p>
            
            <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
              <input
                type="text"
                value={bookInput}
                onChange={(e) => setBookInput(e.target.value)}
                placeholder="Digite o título do livro (ex: Sapiens, 1984, Hábitos Atômicos)..."
                className="w-full px-8 py-6 rounded-2xl bg-white border border-slate-200 shadow-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition-all text-lg outline-none pr-36 text-slate-900 placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="absolute right-3 top-3 bottom-3 px-8 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
              >
                Explorar
              </button>
            </form>

            {error && (
              <p className="mt-6 text-red-500 font-medium bg-red-50 py-2 px-4 rounded-lg inline-block">{error}</p>
            )}

            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { title: 'Aprendizado Profundo', desc: 'Vá além dos fatos com provocações de pensamento crítico.', icon: '🧠' },
                { title: 'Quiz Interativo', desc: 'Teste seu entendimento com perguntas conceituais.', icon: '📝' },
                { title: 'Amplie Horizontes', desc: 'Ganhe insights únicos e perspectivas filosóficas.', icon: '🌍' }
              ].map((feature, i) => (
                <div key={i} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">{feature.title}</h3>
                  <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {state === AppState.LOADING && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Analisando "{bookInput}"</h2>
            <p className="text-slate-500">Gerando flashcards e questões críticas para você...</p>
          </div>
        )}

        {state === AppState.FLASHCARDS && data && (
          <div className="max-w-5xl mx-auto">
            <div className="mb-12 text-center">
              <h2 className="text-4xl font-bold text-slate-900 mb-2">{data.title}</h2>
              <p className="text-xl text-indigo-600 font-medium mb-6">por {data.author}</p>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm max-w-3xl mx-auto">
                <p className="text-slate-700 leading-relaxed text-left">{data.summary}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {data.flashcards.map((card) => (
                <FlashcardItem key={card.id} card={card} />
              ))}
            </div>

            <div className="mt-16 flex justify-center">
              <button 
                onClick={() => setState(AppState.QUIZ)}
                className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-2xl hover:shadow-indigo-200 flex items-center space-x-3"
              >
                <span>Fazer o Quiz</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {state === AppState.QUIZ && data && (
          <Quiz 
            questions={data.quiz} 
            onComplete={handleQuizComplete}
          />
        )}

        {state === AppState.SUMMARY && data && (
          <div className="max-w-2xl mx-auto text-center mt-12 bg-white p-12 rounded-3xl shadow-2xl border border-slate-100">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-8">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-4xl font-black text-slate-900 mb-4">Quiz Finalizado!</h2>
            <div className="mb-8">
              <p className="text-lg text-slate-500 mb-2">Seu Score de Compreensão</p>
              <div className="text-7xl font-black text-indigo-600">
                {quizScore} <span className="text-3xl text-slate-300">/ {data.quiz.length}</span>
              </div>
            </div>
            
            <p className="text-slate-600 mb-10 leading-relaxed italic font-medium">
              "O verdadeiro aprendizado não é um destino, mas uma jornada de investigação crítica."
            </p>

            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 justify-center">
              <button 
                onClick={() => { setState(AppState.QUIZ); setQuizScore(null); }}
                className="px-8 py-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all border border-slate-200"
              >
                Refazer Quiz
              </button>
              <button 
                onClick={reset}
                className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg"
              >
                Estudar Outro Livro
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="py-12 border-t border-slate-200 bg-white">
        <div className="container mx-auto px-6 text-center">
          <p className="text-slate-500 text-sm font-medium">
            © {new Date().getFullYear()} Flashcard Apps - Impulsionado por IA para uma compreensão humana mais profunda.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;

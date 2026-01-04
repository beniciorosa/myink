
import React, { useState } from 'react';
import { QuizQuestion } from '../types';

interface QuizProps {
  questions: QuizQuestion[];
  onComplete: (score: number) => void;
}

export const Quiz: React.FC<QuizProps> = ({ questions, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);

  const currentQuestion = questions[currentIndex];

  const handleOptionClick = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
  };

  const handleNext = () => {
    let currentScore = score;
    if (selectedOption === currentQuestion.correctAnswerIndex) {
      currentScore += 1;
      setScore(currentScore);
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      onComplete(currentScore);
    }
  };

  const checkAnswer = () => {
    if (selectedOption === null) return;
    setIsAnswered(true);
  };

  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-4xl mx-auto w-full animate-fade-in pb-12">
      {/* Quiz Progress Header */}
      <div className="mb-10 bg-white dark:bg-surface-dark p-6 rounded-[32px] border border-slate-100 dark:border-surface-input/30 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[18px]">list_alt</span>
            </div>
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Questão {currentIndex + 1} de {questions.length}</span>
          </div>
          <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{Math.round(progress)}% Concluído</span>
        </div>
        <div className="w-full h-2 bg-slate-100 dark:bg-surface-input rounded-full overflow-hidden shrink-0">
          <div
            className="h-full bg-primary transition-all duration-700 ease-out shadow-[0_0_10px_rgba(19,127,236,0.3)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-surface-dark p-8 md:p-12 rounded-[40px] border border-slate-100 dark:border-surface-input/30 shadow-sm relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute -top-12 -left-12 size-40 bg-primary/5 rounded-full blur-3xl" />

        <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-10 leading-tight uppercase tracking-tight relative z-10">
          {currentQuestion.question}
        </h2>

        <div className="space-y-4 mb-10 relative z-10">
          {currentQuestion.options.map((option, idx) => {
            let bgColor = "bg-slate-50 dark:bg-surface-input/40 border-slate-100 dark:border-transparent hover:border-primary/40";
            let textColor = "text-slate-700 dark:text-text-secondary";
            let Icon = null;

            if (isAnswered) {
              if (idx === currentQuestion.correctAnswerIndex) {
                bgColor = "bg-green-500 text-white border-green-400";
                textColor = "text-white";
                Icon = <span className="material-symbols-outlined text-[20px]">check_circle</span>;
              } else if (idx === selectedOption) {
                bgColor = "bg-red-500 text-white border-red-400";
                textColor = "text-white";
                Icon = <span className="material-symbols-outlined text-[20px]">cancel</span>;
              } else {
                bgColor = "opacity-40 bg-slate-50 dark:bg-surface-input/40 border-slate-100 dark:border-transparent";
              }
            } else if (selectedOption === idx) {
              bgColor = "bg-primary text-white border-primary shadow-lg shadow-primary/20";
              textColor = "text-white";
            }

            return (
              <button
                key={idx}
                disabled={isAnswered}
                onClick={() => handleOptionClick(idx)}
                className={`w-full p-5 md:p-6 text-left rounded-[24px] border-2 transition-all ${bgColor} ${textColor} text-sm md:text-base font-black uppercase tracking-tight flex items-center justify-between group active:scale-[0.98]`}
              >
                <div className="flex items-center gap-4">
                  <div className={`size-8 rounded-xl flex items-center justify-center text-xs font-black transition-colors ${selectedOption === idx || (isAnswered && (idx === currentQuestion.correctAnswerIndex || idx === selectedOption)) ? 'bg-white/20' : 'bg-slate-200 dark:bg-surface-input text-slate-500'}`}>
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <span>{option}</span>
                </div>
                {Icon}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className="mb-10 p-8 bg-slate-50 dark:bg-surface-input/30 rounded-[32px] border border-slate-100 dark:border-surface-input/50 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary">lightbulb</span>
              <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Insights do Mentor</h4>
            </div>
            <p className="text-sm text-slate-500 dark:text-text-secondary leading-relaxed font-bold italic">
              {currentQuestion.explanation}
            </p>
          </div>
        )}

        <div className="flex justify-end relative z-10">
          {!isAnswered ? (
            <button
              onClick={checkAnswer}
              disabled={selectedOption === null}
              className={`px-10 py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${selectedOption === null
                ? 'bg-slate-100 dark:bg-surface-input text-slate-400 cursor-not-allowed'
                : 'bg-primary text-white shadow-xl shadow-primary/20 hover:scale-105 active:scale-95'
                }`}
            >
              Confirmar Escolha
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-10 py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center gap-2"
            >
              {currentIndex === questions.length - 1 ? 'Encerrar Desafio' : 'Próxima Questão'}
              <span className="material-symbols-outlined text-[18px]">{currentIndex === questions.length - 1 ? 'emoji_events' : 'arrow_forward'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

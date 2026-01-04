
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
    <div className="max-w-3xl mx-auto w-full animate-fade-in">
      <div className="mb-8">
        <div className="flex justify-between items-end mb-4">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Questão {currentIndex + 1} / {questions.length}</span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{Math.round(progress)}% Concluído</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-8 leading-tight">
          {currentQuestion.question}
        </h2>

        <div className="space-y-3 mb-8">
          {currentQuestion.options.map((option, idx) => {
            let bgColor = "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500";
            let textColor = "text-gray-700 dark:text-gray-300";

            if (isAnswered) {
              if (idx === currentQuestion.correctAnswerIndex) {
                bgColor = "bg-green-100 dark:bg-green-900/40 border-green-500 dark:border-green-600";
                textColor = "text-green-800 dark:text-green-400";
              } else if (idx === selectedOption) {
                bgColor = "bg-red-100 dark:bg-red-900/40 border-red-500 dark:border-red-600";
                textColor = "text-red-800 dark:text-red-400";
              }
            } else if (selectedOption === idx) {
              bgColor = "bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400";
              textColor = "text-blue-800 dark:text-blue-300";
            }

            return (
              <button
                key={idx}
                disabled={isAnswered}
                onClick={() => handleOptionClick(idx)}
                className={`w-full p-4 text-left rounded-xl border transition-all ${bgColor} ${textColor} text-sm font-medium flex items-center justify-between group`}
              >
                <span>{option}</span>
                {!isAnswered && selectedOption === idx && (
                  <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-800">
            <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-wide">Explicação</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {currentQuestion.explanation}
            </p>
          </div>
        )}

        <div className="flex justify-end">
          {!isAnswered ? (
            <button
              onClick={checkAnswer}
              disabled={selectedOption === null}
              className={`px-8 py-3 rounded-xl font-bold text-sm text-white transition-all ${selectedOption === null
                ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500'
                : 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20'
                }`}
            >
              Verificar
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-md"
            >
              {currentIndex === questions.length - 1 ? 'Resultado' : 'Próxima'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

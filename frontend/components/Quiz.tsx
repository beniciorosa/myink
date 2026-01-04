
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
    <div className="max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <div className="flex justify-between items-end mb-2">
          <span className="text-sm font-bold text-indigo-600">Questão {currentIndex + 1} de {questions.length}</span>
          <span className="text-sm text-slate-400">{Math.round(progress)}% Concluído</span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 mb-8 leading-snug">
          {currentQuestion.question}
        </h2>

        <div className="space-y-4 mb-8">
          {currentQuestion.options.map((option, idx) => {
            let bgColor = "bg-slate-50 border-slate-200 hover:border-indigo-400";
            let textColor = "text-slate-700";

            if (isAnswered) {
              if (idx === currentQuestion.correctAnswerIndex) {
                bgColor = "bg-green-100 border-green-500";
                textColor = "text-green-800";
              } else if (idx === selectedOption) {
                bgColor = "bg-red-100 border-red-500";
                textColor = "text-red-800";
              }
            } else if (selectedOption === idx) {
              bgColor = "bg-indigo-50 border-indigo-500";
              textColor = "text-indigo-800";
            }

            return (
              <button
                key={idx}
                disabled={isAnswered}
                onClick={() => handleOptionClick(idx)}
                className={`w-full p-5 text-left rounded-xl border-2 transition-all ${bgColor} ${textColor} font-medium flex items-center justify-between group`}
              >
                <span>{option}</span>
                {!isAnswered && selectedOption === idx && (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className="mb-8 p-6 bg-slate-50 rounded-xl border-l-4 border-indigo-500 animate-in fade-in slide-in-from-top-2 duration-300">
            <h4 className="font-bold text-slate-900 mb-2">Por que isso é importante:</h4>
            <p className="text-slate-600 leading-relaxed">
              {currentQuestion.explanation}
            </p>
          </div>
        )}

        <div className="flex justify-end">
          {!isAnswered ? (
            <button
              onClick={checkAnswer}
              disabled={selectedOption === null}
              className={`px-10 py-4 rounded-xl font-bold text-white transition-all ${
                selectedOption === null 
                  ? 'bg-slate-300 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-indigo-200'
              }`}
            >
              Verificar Resposta
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-10 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
            >
              {currentIndex === questions.length - 1 ? 'Finalizar Quiz' : 'Próxima Questão'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { Flashcard } from '../types';

interface FlashcardItemProps {
  card: Flashcard;
}

export const FlashcardItem: React.FC<FlashcardItemProps> = ({ card }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className="relative w-full h-80 perspective cursor-pointer group"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className={`relative w-full h-full duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
        {/* Frente */}
        <div className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-8 bg-white rounded-2xl shadow-xl border border-slate-100 hover:shadow-2xl transition-shadow">
          <span className="text-sm font-semibold text-indigo-500 mb-4 uppercase tracking-widest">Pergunta</span>
          <h3 className="text-xl font-bold text-slate-800 text-center leading-tight">
            {card.front}
          </h3>
          <p className="absolute bottom-6 text-slate-400 text-sm animate-pulse">Clique para virar</p>
        </div>

        {/* Verso */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 flex flex-col p-8 bg-indigo-50 rounded-2xl shadow-xl border border-indigo-100 overflow-y-auto">
          <span className="text-sm font-semibold text-indigo-600 mb-4 uppercase tracking-widest">Insight</span>
          <div className="flex-grow">
            <p className="text-lg text-slate-800 font-medium mb-6">
              {card.back}
            </p>
            <div className="p-4 bg-white/50 rounded-xl border border-indigo-200">
              <p className="text-sm text-indigo-900 leading-relaxed italic">
                <strong>Pensamento Crítico:</strong> {card.insight}
              </p>
            </div>
          </div>
          <p className="mt-4 text-center text-slate-400 text-sm">Clique para voltar</p>
        </div>
      </div>
    </div>
  );
};

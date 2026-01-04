import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Flashcard } from '../types';

interface FlashcardItemProps {
  card: Flashcard;
}

export const FlashcardItem: React.FC<FlashcardItemProps> = ({ card }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="aspect-[3/4] [perspective:1000px] group">
      <motion.div
        className="w-full h-full relative [transform-style:preserve-3d] transition-transform duration-700 cursor-pointer rounded-2xl"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* Front - Blue Accent */}
        <div className="absolute inset-0 [backface-visibility:hidden] bg-blue-600 dark:bg-blue-700 rounded-2xl p-6 flex flex-col justify-center items-center text-center shadow-lg">
          <span className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mb-4 opacity-80">Conceito Chave</span>
          <p className="text-base md:text-lg font-bold text-white leading-tight">{card.front}</p>
          <div className="absolute bottom-6 text-[10px] text-blue-200 font-medium uppercase tracking-tighter opacity-50">Clique para revelar</div>
        </div>

        {/* Back - Clean Gray/Dark */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white dark:bg-gray-850 rounded-2xl p-6 flex flex-col items-center justify-center text-center border border-gray-100 dark:border-gray-700 shadow-xl">
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4">Insight IA</span>
          <p className="text-[11px] italic text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
            "{card.insight}"
          </p>
          <div className="h-px w-8 bg-gray-100 dark:bg-gray-700 mb-6"></div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{card.back}</p>
        </div>
      </motion.div>
    </div>
  );
};

export default FlashcardItem;

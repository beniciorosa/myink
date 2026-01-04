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
        className="w-full h-full relative [transform-style:preserve-3d] transition-transform duration-700 cursor-pointer rounded-[32px]"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* Front - Blue Accent */}
        <div className="absolute inset-0 [backface-visibility:hidden] bg-primary dark:bg-primary/90 rounded-[32px] p-8 flex flex-col justify-center items-center text-center shadow-xl border-4 border-white/20 dark:border-white/10">
          <div className="size-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-white text-[24px]">psychology</span>
          </div>
          <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mb-4">Conceito Chave</span>
          <p className="text-xl font-black text-white leading-tight uppercase tracking-tight">{card.front}</p>
          <div className="absolute bottom-8 flex items-center gap-2 text-[10px] text-white/40 font-black uppercase tracking-widest italic group-hover:text-white/60 transition-colors">
            <span className="material-symbols-outlined text-[14px]">touch_app</span>
            Revelar Insight
          </div>
        </div>

        {/* Back - Clean Gray/Dark */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white dark:bg-surface-dark rounded-[32px] p-8 flex flex-col items-center justify-center text-center border border-slate-100 dark:border-surface-input shadow-2xl">
          <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Análise do Mentor</span>
          <p className="text-sm font-bold text-slate-500 dark:text-text-secondary mb-8 leading-relaxed italic">
            "{card.insight}"
          </p>
          <div className="h-px w-10 bg-slate-100 dark:bg-surface-input mb-8" />
          <p className="text-base font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight">{card.back}</p>

          <div className="absolute bottom-8 text-[9px] font-black text-slate-300 uppercase tracking-widest">Toque para voltar</div>
        </div>
      </motion.div>
    </div>
  );
};

export default FlashcardItem;

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Hint } from '../../game/hints';
import { tap } from '../../lib/feedback';

export function HintBubble({ hints }: { hints: Hint[] }) {
  const [index, setIndex] = useState(0);
  if (!hints.length) return null;
  const hint = hints[index % hints.length];

  return (
    <button
      className={`hint-bubble ${hint.tone}`}
      onClick={() => {
        tap();
        setIndex((i) => i + 1);
      }}
    >
      <span className="hint-emoji">{hint.emoji}</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={hint.id}
          className="hint-text"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {hint.text}
        </motion.span>
      </AnimatePresence>
      {hints.length > 1 && (
        <span className="hint-counter mono">
          {(index % hints.length) + 1}/{hints.length}
        </span>
      )}
    </button>
  );
}

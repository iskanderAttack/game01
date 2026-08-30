import { useMemo } from 'react';
import { motion } from 'framer-motion';

const COLORS = ['#d4a24c', '#f0c674', '#34d399', '#fb7185', '#a78bfa', '#38bdf8'];

/** Салют в честь победы. */
export function Confetti({ count = 42 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        duration: 2.1 + Math.random() * 1.5,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 7,
        rotate: Math.random() * 360,
      })),
    [count],
  );

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 30, overflow: 'hidden' }}>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: -40, opacity: 1, rotate: p.rotate }}
          animate={{ y: '105vh', opacity: [1, 1, 0], rotate: p.rotate + 420 }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.5,
            borderRadius: 2,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}

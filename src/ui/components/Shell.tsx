import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { tap } from '../../lib/feedback';

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={`screen ${className}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function TopBar({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="topbar">
      {onBack && (
        <button
          className="icon-btn"
          aria-label="Назад"
          onClick={() => {
            tap();
            onBack();
          }}
        >
          ←
        </button>
      )}
      <div className="grow">
        <h2>{title}</h2>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="row between" style={{ marginTop: 4 }}>
      <div className="label">{children}</div>
      {hint && <div className="label" style={{ letterSpacing: 0, textTransform: 'none' }}>{hint}</div>}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <motion.div
      className="sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </motion.div>
    </motion.div>
  );
}

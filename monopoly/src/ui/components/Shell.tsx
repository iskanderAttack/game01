import { createContext, useContext, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { tap } from '../../lib/feedback';

/**
 * Безопасный режим: интерфейс рисуется вообще без анимаций.
 * Включается сторожем в App, если WebView перестал выдавать кадры
 * (энергосбережение, сворачивание, разделённый экран) — иначе
 * анимация входа зависает и экран остаётся невидимым.
 */
export const SafeMotion = createContext(false);

export function Screen({
  children,
  className = '',
  name,
}: {
  children: ReactNode;
  className?: string;
  name?: string;
}) {
  const safe = useContext(SafeMotion);

  if (safe) {
    return (
      <div className={`screen ${className}`} data-screen={name}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={`screen ${className}`}
      data-screen={name}
      // Прозрачность намеренно не анимируется на входе: если кадры
      // перестанут идти на середине перехода, экран всё равно виден.
      initial={{ y: 14 }}
      animate={{ y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Панель одной фазы внутри экрана — с той же защитой от зависших кадров. */
export function Panel({
  children,
  name,
  className = '',
}: {
  children: ReactNode;
  name: string;
  className?: string;
}) {
  const safe = useContext(SafeMotion);

  if (safe) {
    return (
      <div className={className} data-phase={name}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      data-phase={name}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
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

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="label">{children}</div>;
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
  const safe = useContext(SafeMotion);

  if (safe) {
    return open ? (
      <>
        <div className="sheet-backdrop" onClick={onClose} />
        <div className="sheet">
          <div className="sheet-grip" />
          <h3>{title}</h3>
          {children}
        </div>
      </>
    ) : null;
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <div className="sheet-grip" />
            <h3>{title}</h3>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

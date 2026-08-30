import { motion } from 'framer-motion';
import { tap } from '../../lib/feedback';
import { Avatar } from './PlayerBits';

/** Ширма между ходами: чтобы следующий игрок не увидел чужое поле. */
export function PassDevice({
  name,
  emoji,
  color,
  note,
  onReady,
}: {
  name: string;
  emoji: string;
  color: string;
  note: string;
  onReady: () => void;
}) {
  return (
    <motion.div
      className="handoff"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="handoff-emoji">📱</div>
      <div className="label">Передайте телефон</div>
      <Avatar emoji={emoji} color={color} size={78} />
      <div className="handoff-name">{name}</div>
      <p className="muted" style={{ maxWidth: 320 }}>
        {note}
      </p>
      <button
        className="btn primary"
        style={{ marginTop: 10, minWidth: 200 }}
        onClick={() => {
          tap('select');
          onReady();
        }}
      >
        Это я — продолжить
      </button>
    </motion.div>
  );
}

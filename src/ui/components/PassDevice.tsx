import { motion } from 'framer-motion';
import type { Player } from '../../game/types';
import { Avatar } from './PlayerBits';
import { tap } from '../../lib/feedback';

export function PassDevice({ player, onReady }: { player: Player; onReady: () => void }) {
  return (
    <motion.div
      className="pass-device"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="pass-inner"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <div className="pass-hand">🤲</div>
        <div className="label">Передайте телефон</div>
        <div className="pass-avatar">
          <Avatar player={player} size={104} />
        </div>
        <div className="pass-name">{player.name}</div>
        <p className="muted" style={{ maxWidth: 260, margin: '0 auto' }}>
          Остальные не должны видеть экран. Ваш выбор останется тайной до вскрытия.
        </p>
        <button
          className="btn primary block"
          style={{ marginTop: 26 }}
          onClick={() => {
            tap('select');
            onReady();
          }}
        >
          Это я — показать ход
        </button>
      </motion.div>
    </motion.div>
  );
}

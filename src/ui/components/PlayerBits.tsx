import { motion } from 'framer-motion';
import type { Move, Player } from '../../game/types';

export function Avatar({
  player,
  size = 46,
  dim,
  ring = true,
}: {
  player: Pick<Player, 'emoji' | 'color' | 'isBot'>;
  size?: number;
  dim?: boolean;
  ring?: boolean;
}) {
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        opacity: dim ? 0.45 : 1,
        borderColor: ring ? player.color : 'transparent',
        boxShadow: ring ? `0 0 22px -6px ${player.color}` : 'none',
        background: `radial-gradient(120% 120% at 30% 20%, ${player.color}44, ${player.color}18)`,
      }}
    >
      {player.emoji}
      {player.isBot && <span className="bot-badge">⚙</span>}
    </div>
  );
}

export function HistoryStrip({ history, max = 14 }: { history: Move[]; max?: number }) {
  const shown = history.slice(-max);
  return (
    <div className="history-strip">
      {shown.length === 0 && <span className="history-empty">пока пусто</span>}
      {shown.map((m, i) => (
        <motion.span
          key={`${i}-${m}`}
          className={`history-dot ${m === 'C' ? 'c' : 'd'}`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.012, type: 'spring', stiffness: 500, damping: 24 }}
        />
      ))}
    </div>
  );
}

export function ScoreRow({
  player,
  place,
  delta,
  showHistory = true,
  highlight,
}: {
  player: Player;
  place: number;
  delta?: number;
  showHistory?: boolean;
  highlight?: boolean;
}) {
  const medal = ['🥇', '🥈', '🥉'][place - 1];
  return (
    <motion.div
      layout
      className={`score-row ${highlight ? 'me' : ''}`}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
    >
      <div className="place mono">{medal ?? place}</div>
      <Avatar player={player} size={40} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="score-name">
          {player.name}
          {player.remote && !player.connected && <span className="offline"> офлайн</span>}
        </div>
        {showHistory && <HistoryStrip history={player.history} />}
      </div>
      {delta !== undefined && delta !== 0 && (
        <motion.div
          className={`delta ${delta > 0 ? 'up' : 'down'} mono`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {delta > 0 ? '+' : ''}
          {delta}
        </motion.div>
      )}
      <div className="score-value mono">{player.score}</div>
    </motion.div>
  );
}

export function MoveBadge({ move, size = 'md' }: { move: Move; size?: 'sm' | 'md' }) {
  return (
    <span className={`move-badge ${move === 'C' ? 'c' : 'd'} ${size}`}>
      {move === 'C' ? '🤝' : '🔪'}
      <span>{move === 'C' ? 'Молчал' : 'Сдал'}</span>
    </span>
  );
}

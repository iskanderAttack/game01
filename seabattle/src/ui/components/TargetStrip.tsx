import { tap } from '../../lib/feedback';
import { Avatar, MiniBoard } from './PlayerBits';
import type { EnemyView } from '../../game/engine';

export function TargetStrip({
  enemies,
  targetId,
  onPick,
}: {
  enemies: EnemyView[];
  targetId: string | null;
  onPick: (id: string) => void;
}) {
  if (enemies.length <= 1) return null;

  return (
    <div className="target-strip">
      {enemies.map((e) => (
        <button
          key={e.id}
          className={`target-card ${targetId === e.id ? 'on' : ''} ${e.alive ? '' : 'dead'}`}
          disabled={!e.alive}
          onClick={() => {
            tap('select');
            onPick(e.id);
          }}
        >
          <Avatar emoji={e.emoji} color={e.color} size={26} ring={false} />
          <MiniBoard board={e.board} />
          <div className="target-name">{e.name}</div>
          <div className="target-left mono">
            {e.alive ? `${e.board.shipsLeft} на плаву` : 'потоплен'}
          </div>
        </button>
      ))}
    </div>
  );
}

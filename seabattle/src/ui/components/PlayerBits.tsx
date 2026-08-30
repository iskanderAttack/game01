import { getFleet } from '../../game/fleet';
import type { BoardView, Player, SunkShipView } from '../../game/types';

export function Avatar({
  emoji,
  color,
  size = 40,
  ring = true,
}: {
  emoji: string;
  color: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: `${color}22`,
        borderColor: ring ? color : 'transparent',
      }}
    >
      {emoji}
    </span>
  );
}

/** Полоска оставшегося флота: целые корабли светлые, потопленные — рыжие. */
export function FleetStrip({
  fleetId,
  sunk,
}: {
  fleetId: string;
  sunk: SunkShipView[];
}) {
  const sizes = [...getFleet(fleetId).sizes].sort((a, b) => b - a);
  const deadCounts = new Map<number, number>();
  for (const s of sunk) deadCounts.set(s.size, (deadCounts.get(s.size) ?? 0) + 1);

  const used = new Map<number, number>();

  return (
    <div className="fleet-strip">
      {sizes.map((size, i) => {
        const already = used.get(size) ?? 0;
        const dead = already < (deadCounts.get(size) ?? 0);
        used.set(size, already + 1);
        return (
          <span key={i} className={`fleet-pip ${dead ? 'dead' : ''}`}>
            {Array.from({ length: size }).map((_, j) => (
              <i key={j} />
            ))}
          </span>
        );
      })}
    </div>
  );
}

/** Миниатюра чужого поля для выбора цели. */
export function MiniBoard({ board }: { board: BoardView }) {
  return (
    <div
      className="target-mini"
      style={{ gridTemplateColumns: `repeat(${board.size}, 1fr)` }}
    >
      {board.shots.flatMap((row, y) =>
        row.map((mark, x) => (
          <i key={`${x}-${y}`} className={mark === 1 ? 'm' : mark === 2 ? 'h' : ''} />
        )),
      )}
    </div>
  );
}

export function ScoreRow({
  player,
  place,
  highlight,
}: {
  player: Player;
  place: number;
  highlight?: boolean;
}) {
  const acc = player.stats.shots ? Math.round((player.stats.hits / player.stats.shots) * 100) : 0;
  const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : String(place);

  return (
    <div className={`score-row ${highlight ? 'me' : ''}`}>
      <span className="place">{medal}</span>
      <Avatar emoji={player.emoji} color={player.color} size={36} />
      <div className="grow">
        <div className="player-name">
          {player.name}
          {!player.alive && (
            <span className="chip" style={{ marginLeft: 6 }}>
              потоплен
            </span>
          )}
        </div>
        <div className="player-sub">
          {player.stats.sunk} потоплено · точность {acc}%
        </div>
      </div>
      <div className="mono" style={{ fontWeight: 750 }}>
        {player.stats.hits}
      </div>
    </div>
  );
}

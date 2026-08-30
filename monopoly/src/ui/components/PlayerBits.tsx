import { netWorth, ownedTiles } from '../../game/engine';
import { money } from '../../game/money';
import type { GameState, Player } from '../../game/types';

export function Avatar({
  emoji,
  color,
  size = 36,
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

/** Лента с балансами всех игроков. */
export function PlayerStrip({
  state,
  meId,
  onPick,
}: {
  state: GameState;
  meId?: string | null;
  onPick?: (id: string) => void;
}) {
  const actorId = state.players[state.turnIndex]?.id;

  return (
    <div className="players-row">
      {state.players.map((p) => (
        <button
          key={p.id}
          className={`player-chip ${p.id === actorId ? 'turn' : ''} ${p.bankrupt ? 'out' : ''}`}
          onClick={() => onPick?.(p.id)}
        >
          <span className="who">
            <span className="dot" style={{ background: p.color }} />
            {p.emoji} {p.name}
            {p.id === meId && ' •'}
          </span>
          <div className="cash mono">{p.bankrupt ? 'банкрот' : money(p.money)}</div>
          <div className="sub">
            {ownedTiles(state, p.id).length} уч.
            {p.inJail ? ' · 🔒' : ''}
            {p.jailCards > 0 ? ` · 🔑${p.jailCards}` : ''}
            {p.loan > 0 ? ` · долг ${money(p.loan)}` : ''}
          </div>
        </button>
      ))}
    </div>
  );
}

export function ScoreRow({
  state,
  player,
  place,
  highlight,
}: {
  state: GameState;
  player: Player;
  place: number;
  highlight?: boolean;
}) {
  const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : String(place);

  return (
    <div className={`score-row ${highlight ? 'me' : ''}`}>
      <span className="place">{medal}</span>
      <Avatar emoji={player.emoji} color={player.color} size={36} />
      <div className="grow">
        <div className="player-name">
          {player.name}
          {player.bankrupt && (
            <span className="chip" style={{ marginLeft: 6 }}>
              банкрот
            </span>
          )}
        </div>
        <div className="player-sub">
          {ownedTiles(state, player.id).length} участков · наличными {money(player.money)}
        </div>
      </div>
      <div className="mono" style={{ fontWeight: 800, color: 'var(--gold)' }}>
        {money(netWorth(state, player.id))}
      </div>
    </div>
  );
}

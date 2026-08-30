import { BOARD, GROUP_COLORS, isBuyable } from '../../game/board';
import { moneyShort } from '../../game/money';
import type { GameState, Player, Tile } from '../../game/types';

/**
 * Раскладка сорока клеток по краю сетки 11×11.
 *
 * Отсчёт идёт против часовой стрелки от правого нижнего угла — так же,
 * как ходят фишки на настоящей доске.
 */
export function tilePosition(index: number): { row: number; col: number } {
  if (index === 0) return { row: 11, col: 11 };
  if (index < 10) return { row: 11, col: 11 - index };
  if (index === 10) return { row: 11, col: 1 };
  if (index < 20) return { row: 11 - (index - 10), col: 1 };
  if (index === 20) return { row: 1, col: 1 };
  if (index < 30) return { row: 1, col: 1 + (index - 20) };
  if (index === 30) return { row: 1, col: 11 };
  return { row: 1 + (index - 30), col: 11 };
}

/** Сторона доски определяет, как повернуть цветную полосу. */
function sideOf(index: number): 'bottom' | 'left' | 'top' | 'right' | 'corner' {
  if (index === 0 || index === 10 || index === 20 || index === 30) return 'corner';
  if (index < 10) return 'bottom';
  if (index < 20) return 'left';
  if (index < 30) return 'top';
  return 'right';
}

export function Board({
  state,
  highlight,
  onTile,
}: {
  state: GameState;
  /** Клетка, на которую стоит обратить внимание. */
  highlight?: number | null;
  onTile?: (index: number) => void;
}) {
  const actorId = state.players[state.turnIndex]?.id;

  return (
    <div className="board-wrap">
      <div className="board">
        {BOARD.map((tile) => (
          <TileView
            key={tile.index}
            tile={tile}
            state={state}
            highlight={highlight === tile.index}
            actorId={actorId}
            onTile={onTile}
          />
        ))}
        <BoardCenter state={state} />
      </div>
    </div>
  );
}

function TileView({
  tile,
  state,
  highlight,
  actorId,
  onTile,
}: {
  tile: Tile;
  state: GameState;
  highlight: boolean;
  actorId?: string;
  onTile?: (index: number) => void;
}) {
  const pos = tilePosition(tile.index);
  const side = sideOf(tile.index);
  const prop = state.properties[tile.index];
  const owner = prop?.ownerId ? state.players.find((p) => p.id === prop.ownerId) : null;
  const here = state.players.filter((p) => !p.bankrupt && p.pos === tile.index);

  const classes = ['tile'];
  if (side === 'corner') classes.push('corner');
  else classes.push(`side-${side}`);
  if (prop?.mortgaged) classes.push('mortgaged');
  if (highlight) classes.push('highlight');

  return (
    <div
      className={classes.join(' ')}
      style={{ gridRow: pos.row, gridColumn: pos.col }}
      onClick={() => onTile?.(tile.index)}
    >
      {tile.group && <div className="tile-band" style={{ background: GROUP_COLORS[tile.group] }} />}

      <div className="tile-body">
        {tile.emoji && <span className="tile-emoji">{tile.emoji}</span>}
        {side === 'corner' ? (
          <span className="tile-name">{tile.short}</span>
        ) : (
          <>
            <span className="tile-name">{tile.short}</span>
            {isBuyable(tile) && tile.price && (
              <span className="tile-price">{moneyShort(tile.price)}</span>
            )}
          </>
        )}
      </div>

      {prop && prop.houses > 0 && (
        <div className="tile-houses">
          {prop.houses >= 6 ? (
            <i className="tower" />
          ) : prop.houses === 5 ? (
            <i className="hotel" />
          ) : (
            Array.from({ length: prop.houses }).map((_, i) => <i key={i} />)
          )}
        </div>
      )}

      {owner && <div className="tile-owner" style={{ background: owner.color }} />}

      {here.length > 0 && (
        <div className="tile-tokens">
          {here.map((p) => (
            <Token key={p.id} player={p} active={p.id === actorId} />
          ))}
        </div>
      )}
    </div>
  );
}

function Token({ player, active }: { player: Player; active: boolean }) {
  return (
    <span
      className={`token ${active ? 'active' : ''}`}
      style={{ color: player.color }}
      title={player.name}
    >
      {player.emoji}
    </span>
  );
}

/** Центр доски: кубики и короткая подпись о происходящем. */
function BoardCenter({ state }: { state: GameState }) {
  const actor = state.players[state.turnIndex];

  return (
    <div className="board-center">
      <div className="board-logo">Монополия</div>
      {state.dice && <Dice values={state.dice} />}
      {actor && (
        <div className="center-strong">
          {actor.emoji} {actor.name}
        </div>
      )}
      <div className="center-note">{state.log[0]?.text ?? 'Бросайте кубики'}</div>
    </div>
  );
}

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Dice({ values, rolling }: { values: [number, number]; rolling?: boolean }) {
  return (
    <div className="dice-row">
      {values.map((v, i) => (
        <div key={i} className={`die ${rolling ? 'rolling' : ''}`}>
          {Array.from({ length: 9 }).map((_, cell) => (
            <span key={cell}>{PIPS[v]?.includes(cell) ? <i /> : null}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

import { useMemo } from 'react';
import {
  GROUP_COLORS,
  GROUP_NAMES,
  RAIL_TILES,
  UTILITY_TILES,
  groupTiles,
} from '../../game/board';
import type { ColorGroup, GameState } from '../../game/types';
import { Critter } from './Critter';

/**
 * «Кто чем владеет».
 *
 * Отвечает на единственный вопрос, который решает партию: с кем идти на
 * обмен. По строке видно, что собрал каждый игрок, а подсветкой отмечены
 * группы, где до полного набора не хватает ровно одной клетки — это и есть
 * готовые поводы для сделки.
 */

interface Column {
  key: string;
  label: string;
  color: string;
  tiles: number[];
}

const GROUPS: ColorGroup[] = [
  'brown',
  'lightblue',
  'pink',
  'orange',
  'red',
  'yellow',
  'green',
  'blue',
];

export function OwnershipMatrix({
  state,
  meId,
  onPick,
}: {
  state: GameState;
  meId?: string;
  /** Нажали на клетку матрицы: игрок и группа, по которым удобно торговаться. */
  onPick?: (playerId: string, tiles: number[]) => void;
}) {
  const columns = useMemo<Column[]>(
    () => [
      ...GROUPS.map((g) => ({
        key: g,
        label: GROUP_NAMES[g],
        color: GROUP_COLORS[g],
        tiles: groupTiles(g),
      })),
      { key: 'rail', label: 'Вокзалы', color: '#8A93A6', tiles: RAIL_TILES },
      { key: 'util', label: 'Службы', color: '#C9B07A', tiles: UTILITY_TILES },
    ],
    [],
  );

  const players = state.players.filter((p) => !p.bankrupt);

  return (
    <div className="own-wrap">
      <table className="own-table">
        <thead>
          <tr>
            <th className="own-corner" />
            {columns.map((c) => (
              <th key={c.key} title={c.label}>
                <span className="own-chip" style={{ background: c.color }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className={p.id === meId ? 'me' : ''}>
              <th className="own-who">
                <span className="own-critter">
                  <Critter characterId={p.character} outfit={p.outfit} accent={p.color} size={22} animate={false} />
                </span>
                <span className="own-name">{p.name}</span>
              </th>
              {columns.map((c) => {
                const mine = c.tiles.filter((t) => state.properties[t]?.ownerId === p.id);
                const full = mine.length === c.tiles.length;
                const nearly = mine.length === c.tiles.length - 1 && mine.length > 0;
                if (mine.length === 0) {
                  return (
                    <td key={c.key} className="own-cell empty">
                      ·
                    </td>
                  );
                }
                return (
                  <td
                    key={c.key}
                    className={`own-cell ${full ? 'full' : nearly ? 'nearly' : ''}`}
                    style={{ ['--own' as string]: c.color }}
                    onClick={() => onPick?.(p.id, mine)}
                  >
                    {mine.length}/{c.tiles.length}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="own-legend">
        <span>
          <i className="own-key full" /> группа собрана — можно строить
        </span>
        <span>
          <i className="own-key nearly" /> не хватает одной клетки — есть о чём договориться
        </span>
      </div>
    </div>
  );
}

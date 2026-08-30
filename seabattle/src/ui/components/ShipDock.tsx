import { ROLE_INFO, roleForSize } from '../../game/fleet';
import { tap } from '../../lib/feedback';
import type { Ship } from '../../game/types';

export interface DockEntry {
  size: number;
  total: number;
  placed: number;
}

/** Сколько кораблей каждого размера осталось расставить. */
export function dockEntries(fleetSizes: number[], ships: Ship[]): DockEntry[] {
  const totals = new Map<number, number>();
  for (const s of fleetSizes) totals.set(s, (totals.get(s) ?? 0) + 1);
  const placed = new Map<number, number>();
  for (const s of ships) placed.set(s.size, (placed.get(s.size) ?? 0) + 1);

  return [...totals.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([size, total]) => ({ size, total, placed: placed.get(size) ?? 0 }));
}

export function ShipDock({
  entries,
  selected,
  onSelect,
}: {
  entries: DockEntry[];
  selected: number | null;
  onSelect: (size: number) => void;
}) {
  return (
    <div className="dock">
      {entries.map((e) => {
        const left = e.total - e.placed;
        const done = left === 0;
        return (
          <button
            key={e.size}
            className={`dock-ship ${selected === e.size && !done ? 'on' : ''} ${done ? 'done' : ''}`}
            disabled={done}
            onClick={() => {
              tap('select');
              onSelect(e.size);
            }}
            title={ROLE_INFO[roleForSize(e.size)].name}
          >
            <span className="dock-cells">
              {Array.from({ length: e.size }).map((_, i) => (
                <i key={i} />
              ))}
            </span>
            <span className="dock-count mono">×{left}</span>
          </button>
        );
      })}
    </div>
  );
}

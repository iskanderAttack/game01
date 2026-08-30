import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { shipCells } from '../../game/board';
import { cellName, key, rowLetter } from '../../game/coords';
import { HIT, MISS, NONE, type Coord, type Intel, type Ship, type ShotMark, type SunkShipView } from '../../game/types';

export type BoardMode = 'own' | 'enemy' | 'placement';

export interface BoardProps {
  size: number;
  shots: ShotMark[][];
  mode: BoardMode;
  /** Свои корабли — показываются только на своём поле. */
  ships?: Ship[];
  mines?: Coord[];
  sunk?: SunkShipView[];
  intel?: Intel;
  aim?: Coord | null;
  onAim?: (c: Coord | null) => void;
  onCommit?: (c: Coord) => void;
  onShipTap?: (shipId: string) => void;
  /** Предпросмотр корабля при расстановке. */
  preview?: { cells: Coord[]; ok: boolean } | null;
  onHover?: (c: Coord | null) => void;
  forbidden?: Set<string>;
  disabled?: boolean;
  /** Отпускание пальца сразу совершает действие. */
  commitOnRelease?: boolean;
  showCoords?: boolean;
  /** Дополнительный класс обёртки: own — своё поле поменьше, dense — плотная сетка. */
  wrapClass?: string;
  /** Клетки, по которым только что отработала способность, — подсвечиваются вспышкой. */
  flash?: Set<string>;
}

interface ShipCellInfo {
  shipId: string;
  index: number;
  last: boolean;
  dir: 'h' | 'v';
}

export function Board({
  size,
  shots,
  mode,
  ships = [],
  mines = [],
  sunk = [],
  intel,
  aim,
  onAim,
  onCommit,
  onShipTap,
  preview,
  onHover,
  forbidden,
  disabled,
  commitOnRelease,
  showCoords = true,
  wrapClass = '',
  flash,
}: BoardProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [magnifier, setMagnifier] = useState<{ x: number; y: number; cell: Coord } | null>(null);
  const draggingRef = useRef(false);

  /* Карты для быстрой отрисовки клеток. */
  const shipMap = useMemo(() => {
    const map = new Map<string, ShipCellInfo>();
    for (const ship of ships) {
      shipCells(ship).forEach((c, i) => {
        map.set(key(c.x, c.y), {
          shipId: ship.id,
          index: i,
          last: i === ship.size - 1,
          dir: ship.dir,
        });
      });
    }
    return map;
  }, [ships]);

  const sunkCells = useMemo(() => {
    const set = new Set<string>();
    for (const s of sunk) {
      for (let i = 0; i < s.size; i++) {
        set.add(key(s.dir === 'h' ? s.x + i : s.x, s.dir === 'v' ? s.y + i : s.y));
      }
    }
    return set;
  }, [sunk]);

  const previewCells = useMemo(() => {
    const set = new Set<string>();
    for (const c of preview?.cells ?? []) set.add(key(c.x, c.y));
    return set;
  }, [preview]);

  const revealed = useMemo(() => {
    const set = new Set<string>();
    for (const c of intel?.revealed ?? []) set.add(key(c.x, c.y));
    return set;
  }, [intel]);

  /**
   * Следы разведки на карте.
   *
   * Без них способности выглядят так, будто ничего не произошло:
   * энергия ушла, а на поле — пусто. Поэтому просвеченный радаром
   * квадрат остаётся подкрашенным, а найденное число палуб пишется
   * прямо в его центре.
   */
  const radarArea = useMemo(() => {
    const set = new Set<string>();
    for (const r of intel?.radar ?? []) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) set.add(key(r.x + dx, r.y + dy));
      }
    }
    return set;
  }, [intel]);

  const radarEmpty = useMemo(() => {
    const set = new Set<string>();
    for (const r of intel?.radar ?? []) {
      if (r.count !== 0) continue;
      // Пустой квадрат можно смело вычеркнуть целиком.
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) set.add(key(r.x + dx, r.y + dy));
      }
    }
    return set;
  }, [intel]);

  const radarBadges = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of intel?.radar ?? []) {
      if (r.count > 0) map.set(key(r.x, r.y), r.count);
    }
    return map;
  }, [intel]);

  const scannedRows = useMemo(() => {
    const map = new Map<number, number>();
    for (const l of intel?.lines ?? []) if (l.axis === 'row') map.set(l.index, l.count);
    return map;
  }, [intel]);

  const scannedCols = useMemo(() => {
    const map = new Map<number, number>();
    for (const l of intel?.lines ?? []) if (l.axis === 'col') map.set(l.index, l.count);
    return map;
  }, [intel]);

  /** Счётчик авиаразведки — в первой клетке просвеченной линии. */
  const lineBadges = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of intel?.lines ?? []) {
      map.set(l.axis === 'row' ? key(0, l.index) : key(l.index, 0), l.count);
    }
    return map;
  }, [intel]);

  /* ─────────────────────── работа с указателем ─────────────────────── */

  const cellFromEvent = (e: ReactPointerEvent): Coord | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const cw = rect.width / size;
    const ch = rect.height / size;
    const x = Math.floor(relX / cw);
    const y = Math.floor(relY / ch);
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    return { x, y };
  };

  const handleDown = (e: ReactPointerEvent) => {
    if (disabled) return;
    const cell = cellFromEvent(e);
    if (!cell) return;

    // На своём поле тап по кораблю — это поворот, а не прицеливание.
    if (mode === 'placement' && onShipTap) {
      const info = shipMap.get(key(cell.x, cell.y));
      if (info) {
        onShipTap(info.shipId);
        return;
      }
    }

    draggingRef.current = true;
    onAim?.(cell);
    onHover?.(cell);
    if (mode === 'enemy') {
      const rect = gridRef.current!.getBoundingClientRect();
      setMagnifier({ x: e.clientX - rect.left, y: e.clientY - rect.top, cell });
    }
  };

  const handleMove = (e: ReactPointerEvent) => {
    if (disabled || !draggingRef.current) return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    onAim?.(cell);
    onHover?.(cell);
    if (mode === 'enemy') {
      const rect = gridRef.current!.getBoundingClientRect();
      setMagnifier({ x: e.clientX - rect.left, y: e.clientY - rect.top, cell });
    }
  };

  const handleUp = (e: ReactPointerEvent) => {
    if (disabled) return;
    const wasDragging = draggingRef.current;
    draggingRef.current = false;
    setMagnifier(null);
    if (!wasDragging) return;

    const cell = cellFromEvent(e) ?? aim ?? null;
    if (!cell) return;
    if (commitOnRelease) onCommit?.(cell);
  };

  /* ─────────────────────────── отрисовка ─────────────────────────── */

  const cells = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = key(x, y);
      const mark = shots[y]?.[x] ?? NONE;
      const info = shipMap.get(k);
      const isSunkCell = sunkCells.has(k);

      const classes = ['cell'];
      if (!disabled) classes.push('clickable');

      if (info && mode !== 'enemy') {
        classes.push('ship');
        if (info.index === 0) classes.push(info.dir === 'h' ? 'head' : 'head-v');
        if (info.last) classes.push(info.dir === 'h' ? 'tail' : 'tail-v');
      }

      if (mark === MISS) classes.push('miss');
      else if (mark === HIT) classes.push(isSunkCell ? 'sunk' : 'hit');

      if (isSunkCell && mark !== HIT) classes.push('sunk');
      if (mode === 'own' && mines.some((m) => m.x === x && m.y === y)) classes.push('mine');
      if (mode === 'enemy' && revealed.has(k) && mark === NONE) classes.push('revealed');
      if (mode === 'enemy' && mark === NONE) {
        if (radarEmpty.has(k)) classes.push('radar-empty');
        else if (radarArea.has(k)) classes.push('radar-area');
        else if (scannedRows.has(y) || scannedCols.has(x)) classes.push('scanned');
      }
      if (previewCells.has(k)) classes.push(preview?.ok ? 'preview-ok' : 'preview-bad');
      if (mode === 'placement' && !info && forbidden?.has(k)) classes.push('forbidden');
      if (aim && aim.x === x && aim.y === y) classes.push('aim');
      if (flash?.has(k)) classes.push('flash');

      const radarCount = mode === 'enemy' ? radarBadges.get(k) : undefined;
      const lineCount = mode === 'enemy' ? lineBadges.get(k) : undefined;

      cells.push(
        <div key={k} className={classes.join(' ')}>
          {radarCount !== undefined && mark === NONE && <span className="radar-badge">{radarCount}</span>}
          {radarCount === undefined && lineCount !== undefined && mark === NONE && (
            <span className="radar-badge line">{lineCount}</span>
          )}
        </div>,
      );
    }
  }

  const grid = (
    <div
      ref={gridRef}
      className={`board-grid ${mode === 'enemy' ? 'enemy' : ''} ${disabled ? 'locked' : ''}`}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={() => {
        draggingRef.current = false;
        setMagnifier(null);
      }}
    >
      {cells}
      {magnifier && <Magnifier grid={{ size, shots, sunk: sunkCells, revealed }} spot={magnifier} />}
    </div>
  );

  if (!showCoords) {
    return (
      <div className={`board-wrap ${wrapClass}`} style={{ ['--n' as string]: size }}>
        {grid}
      </div>
    );
  }

  return (
    <div className={`board-wrap ${wrapClass}`} style={{ ['--n' as string]: size }}>
      <div className="board-layout">
        <div />
        <div className="board-axis cols">
          {Array.from({ length: size }).map((_, i) => (
            <span key={i} className={scannedCols.has(i) ? 'scanned-axis' : undefined}>
              {i + 1}
            </span>
          ))}
        </div>
        <div className="board-axis rows">
          {Array.from({ length: size }).map((_, i) => (
            <span key={i} className={scannedRows.has(i) ? 'scanned-axis' : undefined}>
              {rowLetter(i)}
            </span>
          ))}
        </div>
        {grid}
      </div>
    </div>
  );
}

/** Увеличенный кусочек поля над пальцем — палец закрывает саму клетку. */
function Magnifier({
  grid,
  spot,
}: {
  grid: { size: number; shots: ShotMark[][]; sunk: Set<string>; revealed: Set<string> };
  spot: { x: number; y: number; cell: Coord };
}) {
  const cells = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = spot.cell.x + dx;
      const y = spot.cell.y + dy;
      const inside = x >= 0 && y >= 0 && x < grid.size && y < grid.size;
      const mark = inside ? grid.shots[y][x] : NONE;
      const center = dx === 0 && dy === 0;
      cells.push(
        <div
          key={`${dx},${dy}`}
          style={{
            opacity: inside ? 1 : 0.25,
            boxShadow: center ? 'inset 0 0 0 2px var(--accent)' : undefined,
            background:
              mark === HIT
                ? grid.sunk.has(key(x, y))
                  ? 'var(--sunk-dim)'
                  : 'var(--hit-dim)'
                : mark === MISS
                  ? 'var(--miss-dim)'
                  : undefined,
          }}
        >
          {mark === HIT ? '✕' : mark === MISS ? '·' : grid.revealed.has(key(x, y)) ? '◎' : ''}
        </div>,
      );
    }
  }

  return (
    <div
      className="magnifier"
      style={{
        left: Math.max(0, Math.min(spot.x - 46, 999)),
        top: spot.y - 128,
      }}
    >
      <div className="mini">{cells}</div>
      <div className="coord mono">{cellName(spot.cell.x, spot.cell.y)}</div>
    </div>
  );
}

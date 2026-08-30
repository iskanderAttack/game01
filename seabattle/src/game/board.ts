import { around, inBoard, key, makeRng } from './coords';
import { roleForSize } from './fleet';
import { NONE, type Board, type Coord, type Orientation, type Ship, type ShotMark, type SunkShipView } from './types';

export function emptyBoard(size: number): Board {
  return {
    size,
    ships: [],
    shots: Array.from({ length: size }, () => Array<ShotMark>(size).fill(NONE)),
    mines: [],
  };
}

/** Клетки, которые занимает корабль. */
export function shipCells(ship: Ship): Coord[] {
  const out: Coord[] = [];
  for (let i = 0; i < ship.size; i++) {
    out.push({
      x: ship.dir === 'h' ? ship.x + i : ship.x,
      y: ship.dir === 'v' ? ship.y + i : ship.y,
    });
  }
  return out;
}

export function shipFits(size: number, ship: Ship): boolean {
  const last = shipCells(ship)[ship.size - 1];
  return inBoard(size, ship.x, ship.y) && inBoard(size, last.x, last.y);
}

/**
 * Можно ли поставить корабль: он должен помещаться в поле и не пересекаться
 * с остальными. Если касание бортами запрещено — ещё и не соприкасаться.
 */
export function canPlace(board: Board, ship: Ship, allowTouching: boolean): boolean {
  if (!shipFits(board.size, ship)) return false;

  const occupied = new Set<string>();
  for (const other of board.ships) {
    if (other.id === ship.id) continue;
    for (const c of shipCells(other)) {
      occupied.add(key(c.x, c.y));
      if (!allowTouching) {
        for (const n of around(board.size, c.x, c.y)) occupied.add(key(n.x, n.y));
      }
    }
  }

  return shipCells(ship).every((c) => !occupied.has(key(c.x, c.y)));
}

/** Клетки, куда ставить нельзя — для подсветки во время расстановки. */
export function forbiddenCells(board: Board, allowTouching: boolean, exceptId?: string): Set<string> {
  const out = new Set<string>();
  for (const ship of board.ships) {
    if (ship.id === exceptId) continue;
    for (const c of shipCells(ship)) {
      out.add(key(c.x, c.y));
      if (!allowTouching) {
        for (const n of around(board.size, c.x, c.y)) out.add(key(n.x, n.y));
      }
    }
  }
  return out;
}

export function shipAt(board: Board, x: number, y: number): Ship | undefined {
  return board.ships.find((s) => shipCells(s).some((c) => c.x === x && c.y === y));
}

export function isSunk(ship: Ship): boolean {
  return ship.hits.every(Boolean);
}

export function shipsLeft(board: Board): number {
  return board.ships.filter((s) => !isSunk(s)).length;
}

export function cellsLeft(board: Board): number {
  return board.ships.reduce((sum, s) => sum + s.hits.filter((h) => !h).length, 0);
}

export function fleetDestroyed(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every(isSunk);
}

export function sunkViews(board: Board): SunkShipView[] {
  return board.ships.filter(isSunk).map((s) => ({ size: s.size, x: s.x, y: s.y, dir: s.dir, role: s.role }));
}

/** Сколько кораблей каждого размера ещё на плаву. */
export function remainingBySize(board: Board): Record<number, number> {
  const out: Record<number, number> = {};
  for (const s of board.ships) {
    if (isSunk(s)) continue;
    out[s.size] = (out[s.size] ?? 0) + 1;
  }
  return out;
}

let shipCounter = 0;

export function makeShip(size: number, x: number, y: number, dir: Orientation): Ship {
  shipCounter += 1;
  return {
    id: `s${Date.now().toString(36)}${shipCounter.toString(36)}`,
    size,
    role: roleForSize(size),
    x,
    y,
    dir,
    hits: Array<boolean>(size).fill(false),
  };
}

/**
 * Случайная расстановка флота.
 *
 * Крупные корабли ставим первыми — их труднее пристроить. Если поле
 * оказалось слишком тесным, перезапускаем расстановку целиком, а не
 * пытаемся бесконечно втиснуть последний катер.
 */
export function autoPlace(
  size: number,
  sizes: number[],
  allowTouching: boolean,
  seed?: number,
): Ship[] | null {
  const rng = makeRng(seed ?? Math.floor(Math.random() * 2 ** 31));
  const ordered = [...sizes].sort((a, b) => b - a);

  for (let attempt = 0; attempt < 60; attempt++) {
    const board = emptyBoard(size);
    let ok = true;

    for (const shipSize of ordered) {
      let placed = false;
      for (let tries = 0; tries < 400 && !placed; tries++) {
        const dir: Orientation = rng() < 0.5 ? 'h' : 'v';
        const x = Math.floor(rng() * (dir === 'h' ? size - shipSize + 1 : size));
        const y = Math.floor(rng() * (dir === 'v' ? size - shipSize + 1 : size));
        const ship = makeShip(shipSize, x, y, dir);
        if (canPlace(board, ship, allowTouching)) {
          board.ships.push(ship);
          placed = true;
        }
      }
      if (!placed) {
        ok = false;
        break;
      }
    }

    if (ok) return board.ships;
  }

  return null;
}

/** Повернуть корабль вокруг его первой клетки, если позволяет место. */
export function rotated(ship: Ship): Ship {
  return { ...ship, dir: ship.dir === 'h' ? 'v' : 'h' };
}

/** Обводка потопленного корабля — клетки вокруг, которые можно раскрыть. */
export function halo(board: Board, ship: Ship): Coord[] {
  const own = new Set(shipCells(ship).map((c) => key(c.x, c.y)));
  const out: Coord[] = [];
  const seen = new Set<string>();
  for (const c of shipCells(ship)) {
    for (const n of around(board.size, c.x, c.y)) {
      const k = key(n.x, n.y);
      if (own.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
  }
  return out;
}

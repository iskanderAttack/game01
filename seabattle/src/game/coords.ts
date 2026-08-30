/** Буквы рядов в русской традиции морского боя — без Ё, Й и мягких знаков. */
const LETTERS = 'АБВГДЕЖЗИКЛМНОПР';

export function rowLetter(y: number): string {
  return LETTERS[y] ?? String(y + 1);
}

/** Человеческое имя клетки: Б7. */
export function cellName(x: number, y: number): string {
  return `${rowLetter(y)}${x + 1}`;
}

export function inBoard(size: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size && y < size;
}

export const key = (x: number, y: number) => `${x},${y}`;

/** Восемь соседей клетки. */
export function around(size: number, x: number, y: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (inBoard(size, nx, ny)) out.push({ x: nx, y: ny });
    }
  }
  return out;
}

/** Четыре соседа по стороне. */
export function neighbours(size: number, x: number, y: number): { x: number; y: number }[] {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ].filter((c) => inBoard(size, c.x, c.y));
}

/** Детерминированный генератор — чтобы партию можно было повторить по seed. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Геометрия доски в логических пикселях.
 *
 * Доска рисуется в постоянном размере 1100×1100 и показывается через камеру,
 * а не ужимается под экран. Именно поэтому названия улиц наконец читаются:
 * боковая клетка получается 89 пикселей в ширину и 150 в глубину, и в неё
 * спокойно помещаются две строки по 13 пикселей.
 */
export const BOARD_PX = 1100;
/** Угловая клетка — квадрат; её сторона задаёт и глубину боковых клеток. */
export const CORNER_PX = 150;
/** Ширина рядовой клетки: девять штук на сторону между углами. */
export const CELL_PX = (BOARD_PX - 2 * CORNER_PX) / 9;

/** Наклон доски. Умеренный: дальний ряд сжимается, но остаётся читаемым. */
export const TILT_DEG = 42;

export type BoardSide = 'bottom' | 'left' | 'top' | 'right' | 'corner';

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
  side: BoardSide;
}

/** Сторона доски, на которой стоит клетка. */
export function sideOf(index: number): BoardSide {
  if (index % 10 === 0) return 'corner';
  if (index < 10) return 'bottom';
  if (index < 20) return 'left';
  if (index < 30) return 'top';
  return 'right';
}

/**
 * Прямоугольник клетки. Отсчёт против часовой стрелки от правого нижнего
 * угла — так же, как ходят фишки на настоящей доске.
 */
export function tileRect(index: number): TileRect {
  const i = ((index % 40) + 40) % 40;
  const far = BOARD_PX - CORNER_PX;

  if (i === 0) return { x: far, y: far, w: CORNER_PX, h: CORNER_PX, side: 'corner' };
  if (i < 10) {
    return { x: far - i * CELL_PX, y: far, w: CELL_PX, h: CORNER_PX, side: 'bottom' };
  }
  if (i === 10) return { x: 0, y: far, w: CORNER_PX, h: CORNER_PX, side: 'corner' };
  if (i < 20) {
    return { x: 0, y: far - (i - 10) * CELL_PX, w: CORNER_PX, h: CELL_PX, side: 'left' };
  }
  if (i === 20) return { x: 0, y: 0, w: CORNER_PX, h: CORNER_PX, side: 'corner' };
  if (i < 30) {
    return { x: CORNER_PX + (i - 21) * CELL_PX, y: 0, w: CELL_PX, h: CORNER_PX, side: 'top' };
  }
  if (i === 30) return { x: far, y: 0, w: CORNER_PX, h: CORNER_PX, side: 'corner' };
  return { x: far, y: CORNER_PX + (i - 31) * CELL_PX, w: CORNER_PX, h: CELL_PX, side: 'right' };
}

/** Центр клетки — к нему привязаны фишки и камера. */
export function tileCenter(index: number): { x: number; y: number } {
  const r = tileRect(index);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/**
 * Где стоит фишка на клетке.
 *
 * Несколько фишек на одной клетке расходятся по сетке 3×2, чтобы не
 * закрывать друг друга и не вылезать за края.
 */
export function pawnSpot(index: number, slot: number): { x: number; y: number } {
  const r = tileRect(index);
  const cols = 3;
  const col = slot % cols;
  const row = Math.floor(slot / cols) % 2;
  const stepX = Math.min(26, r.w / 3.4);
  const stepY = Math.min(26, r.h / 3.4);
  // Фишки стоят у внешнего края клетки: середина занята подписью, а фигурка
  // рисуется вверх от лап и иначе закрывала бы название улицы.
  const outward: Record<string, number> = { bottom: 0.9, top: 0.28, left: 0.5, right: 0.5, corner: 0.78 };
  const inward: Record<string, number> = { left: 0.26, right: 0.74 };
  return {
    x: r.x + r.w * (inward[r.side] ?? 0.5) + (col - 1) * stepX,
    y: r.y + r.h * (outward[r.side] ?? 0.78) + (row - 0.5) * stepY,
  };
}

/** Кратчайший путь вперёд по кругу — фишка всегда идёт по часовой стрелке хода. */
export function stepsBetween(from: number, to: number): number {
  return (((to - from) % 40) + 40) % 40;
}

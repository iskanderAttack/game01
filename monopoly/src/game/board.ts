import type { ColorGroup, Tile } from './types';

/** Номиналы классической игры, переведённые в рубли. */
const K = 1000;

const street = (
  index: number,
  name: string,
  short: string,
  group: ColorGroup,
  price: number,
  rent: number[],
  houseCost: number,
): Tile => ({
  index,
  kind: 'street',
  name,
  short,
  group,
  price: price * K,
  rent: rent.map((r) => r * K),
  houseCost: houseCost * K,
});

/**
 * Доска на сорок клеток — в точности классическая расстановка:
 * восемь цветных групп, четыре вокзала, две коммунальные службы,
 * шесть карточных клеток, два налога и четыре угла.
 */
export const BOARD: Tile[] = [
  { index: 0, kind: 'go', name: 'Старт', short: 'Старт', emoji: '🏁' },
  street(1, 'Луговая улица', 'Луговая', 'brown', 60, [2, 10, 30, 90, 160, 250], 50),
  { index: 2, kind: 'chest', name: 'Общественная казна', short: 'Казна', emoji: '🎁' },
  street(3, 'Заречная улица', 'Заречная', 'brown', 60, [4, 20, 60, 180, 320, 450], 50),
  { index: 4, kind: 'tax', name: 'Подоходный налог', short: 'Налог', tax: 200 * K, emoji: '🧾' },
  { index: 5, kind: 'rail', name: 'Ленинградский вокзал', short: 'Ленингр.', price: 200 * K, emoji: '🚂' },

  street(6, 'Садовая улица', 'Садовая', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  { index: 7, kind: 'chance', name: 'Шанс', short: 'Шанс', emoji: '❓' },
  street(8, 'Речная улица', 'Речная', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  street(9, 'Лесная улица', 'Лесная', 'lightblue', 120, [8, 40, 100, 300, 450, 600], 50),

  { index: 10, kind: 'jail', name: 'Тюрьма', short: 'Тюрьма', emoji: '🔒' },
  street(11, 'Улица Пушкина', 'Пушкина', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  { index: 12, kind: 'utility', name: 'Электростанция', short: 'Электро', price: 150 * K, emoji: '💡' },
  street(13, 'Улица Гагарина', 'Гагарина', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  street(14, 'Улица Мира', 'Мира', 'pink', 160, [12, 60, 180, 500, 700, 900], 100),
  { index: 15, kind: 'rail', name: 'Казанский вокзал', short: 'Казанский', price: 200 * K, emoji: '🚂' },

  street(16, 'Арбат', 'Арбат', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  { index: 17, kind: 'chest', name: 'Общественная казна', short: 'Казна', emoji: '🎁' },
  street(18, 'Тверская улица', 'Тверская', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  street(19, 'Никольская улица', 'Никольская', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100),

  { index: 20, kind: 'parking', name: 'Бесплатная стоянка', short: 'Стоянка', emoji: '🅿️' },
  street(21, 'Улица Рубинштейна', 'Рубинштейна', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  { index: 22, kind: 'chance', name: 'Шанс', short: 'Шанс', emoji: '❓' },
  street(23, 'Невский проспект', 'Невский', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  street(24, 'Дворцовая площадь', 'Дворцовая', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
  { index: 25, kind: 'rail', name: 'Курский вокзал', short: 'Курский', price: 200 * K, emoji: '🚂' },

  street(26, 'Большая Морская', 'Б. Морская', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  street(27, 'Литейный проспект', 'Литейный', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  { index: 28, kind: 'utility', name: 'Водопровод', short: 'Водопровод', price: 150 * K, emoji: '🚰' },
  street(29, 'Кутузовский проспект', 'Кутузовский', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150),

  { index: 30, kind: 'gotojail', name: 'Отправляйтесь в тюрьму', short: 'В тюрьму', emoji: '🚔' },
  street(31, 'Малая Бронная', 'М. Бронная', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  street(32, 'Остоженка', 'Остоженка', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { index: 33, kind: 'chest', name: 'Общественная казна', short: 'Казна', emoji: '🎁' },
  street(34, 'Патриаршие пруды', 'Патриаршие', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  { index: 35, kind: 'rail', name: 'Павелецкий вокзал', short: 'Павелецкий', price: 200 * K, emoji: '🚂' },

  { index: 36, kind: 'chance', name: 'Шанс', short: 'Шанс', emoji: '❓' },
  street(37, 'Рублёвское шоссе', 'Рублёвка', 'blue', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { index: 38, kind: 'tax', name: 'Налог на роскошь', short: 'Роскошь', tax: 100 * K, emoji: '💎' },
  street(39, 'Красная площадь', 'Красная пл.', 'blue', 400, [50, 200, 600, 1400, 1700, 2000], 200),
];

export const GROUP_COLORS: Record<ColorGroup, string> = {
  brown: '#8B5E3C',
  lightblue: '#7FD3F5',
  pink: '#E0559B',
  orange: '#F08A24',
  red: '#E4402E',
  yellow: '#F2C230',
  green: '#3FA85F',
  blue: '#2C57C4',
};

export const GROUP_NAMES: Record<ColorGroup, string> = {
  brown: 'Окраина',
  lightblue: 'Тихий центр',
  pink: 'Старый город',
  orange: 'Бульвары',
  red: 'Проспекты',
  yellow: 'Набережные',
  green: 'Престиж',
  blue: 'Элита',
};

/** Все клетки одной цветной группы. */
export function groupTiles(group: ColorGroup): number[] {
  return BOARD.filter((t) => t.group === group).map((t) => t.index);
}

export const RAIL_TILES = BOARD.filter((t) => t.kind === 'rail').map((t) => t.index);
export const UTILITY_TILES = BOARD.filter((t) => t.kind === 'utility').map((t) => t.index);

/** Клетки, которые можно купить. */
export function isBuyable(tile: Tile): boolean {
  return tile.kind === 'street' || tile.kind === 'rail' || tile.kind === 'utility';
}

export const JAIL_INDEX = 10;
export const GO_TO_JAIL_INDEX = 30;
export const BOARD_SIZE = 40;

/** Стоимость выхода из тюрьмы. */
export const JAIL_FEE = 50 * K;

/** Аренда вокзалов по числу вокзалов у владельца. */
export const RAIL_RENT = [0, 25 * K, 50 * K, 100 * K, 200 * K];

/** Множители для коммунальных служб: одна — ×4, обе — ×10 от броска. */
export const UTILITY_MULTIPLIER = [0, 4, 10];

/** Небоскрёб в режиме «Магнат» стоит вдвое дороже отеля и приносит больше. */
export const SKYSCRAPER_RENT_FACTOR = 1.75;
export const SKYSCRAPER_COST_FACTOR = 2;

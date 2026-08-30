import type { ShipRole } from './types';

export interface FleetPreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Размеры кораблей от крупного к мелкому. */
  sizes: number[];
  /** Рекомендуемый размер поля. */
  boardSize: number;
}

export const FLEETS: FleetPreset[] = [
  {
    id: 'classic',
    name: 'Классический',
    emoji: '⚓',
    description: 'Один четырёхпалубный, два трёхпалубных, три двухпалубных и четыре катера. Канон.',
    sizes: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1],
    boardSize: 10,
  },
  {
    id: 'western',
    name: 'Морской',
    emoji: '🚢',
    description: 'Пять крупных кораблей без мелочи. Меньше кораблей, но каждый заметнее.',
    sizes: [5, 4, 3, 3, 2],
    boardSize: 10,
  },
  {
    id: 'small',
    name: 'Малый',
    emoji: '⛵',
    description: 'Пять кораблей на компактном поле. Партия на десять минут — и для детей.',
    sizes: [3, 2, 2, 1, 1],
    boardSize: 7,
  },
  {
    id: 'armada',
    name: 'Армада',
    emoji: '🛳️',
    description: 'Девять кораблей на большом поле. Долгая позиционная война.',
    sizes: [5, 4, 4, 3, 3, 2, 2, 1, 1],
    boardSize: 12,
  },
  {
    id: 'duel',
    name: 'Дуэль',
    emoji: '🗡️',
    description: 'Три корабля на тесном поле. Молниеносно и очень нервно.',
    sizes: [3, 2, 1],
    boardSize: 6,
  },
];

export function getFleet(id: string): FleetPreset {
  return FLEETS.find((f) => f.id === id) ?? FLEETS[0];
}

/** Роль корабля выводится из его размера. */
export function roleForSize(size: number): ShipRole {
  if (size >= 5) return 'carrier';
  if (size === 4) return 'battleship';
  if (size === 3) return 'cruiser';
  if (size === 2) return 'destroyer';
  return 'submarine';
}

export const ROLE_INFO: Record<ShipRole, { name: string; emoji: string; note: string }> = {
  carrier: { name: 'Авианосец', emoji: '🛳️', note: 'Пять палуб. Заряжает авиаразведку.' },
  battleship: { name: 'Линкор', emoji: '🚢', note: 'Четыре палубы. Главный калибр эскадры.' },
  cruiser: { name: 'Крейсер', emoji: '⛴️', note: 'Три палубы. Несёт радар.' },
  destroyer: { name: 'Эсминец', emoji: '🛥️', note: 'Две палубы. Быстрый и юркий.' },
  submarine: { name: 'Катер', emoji: '⛵', note: 'Одна палуба. Найти труднее всего.' },
};

/** Сколько всего корабельных клеток во флоте. */
export function fleetCells(sizes: number[]): number {
  return sizes.reduce((a, b) => a + b, 0);
}

/** Насколько плотно флот забивает поле — для предупреждения при настройке. */
export function fleetDensity(sizes: number[], boardSize: number): number {
  return fleetCells(sizes) / (boardSize * boardSize);
}

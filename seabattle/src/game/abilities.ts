export type AbilityTarget =
  /** Клетка на поле соперника. */
  | 'enemyCell'
  /** Ряд или столбец на поле соперника. */
  | 'enemyLine'
  /** Клетка на собственном поле. */
  | 'ownCell'
  /** Поле соперника целиком, без выбора точки. */
  | 'enemyBoard'
  /** Не требует цели. */
  | 'self';

export interface Ability {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  target: AbilityTarget;
  short: string;
  description: string;
  /** Заканчивает ход, даже если попал. */
  endsTurn: boolean;
}

export const ABILITIES: Ability[] = [
  {
    id: 'radar',
    name: 'Радар',
    emoji: '📡',
    cost: 2,
    target: 'enemyCell',
    short: 'Сколько палуб в квадрате 3×3',
    description:
      'Просвечивает квадрат три на три вокруг выбранной клетки и сообщает, сколько корабельных клеток внутри. Где именно — не показывает. Лучший способ отсечь пустые районы.',
    endsTurn: true,
  },
  {
    id: 'recon',
    name: 'Авиаразведка',
    emoji: '✈️',
    cost: 3,
    target: 'enemyLine',
    short: 'Просветить ряд или столбец',
    description:
      'Самолёт проходит вдоль ряда или столбца и докладывает, сколько корабельных клеток на этой линии. Незаменимо на большом поле, когда стрелять наугад уже дорого.',
    endsTurn: true,
  },
  {
    id: 'salvo',
    name: 'Залп',
    emoji: '💥',
    cost: 4,
    target: 'enemyCell',
    short: 'Три выстрела подряд по линии',
    description:
      'Накрывает три клетки подряд от выбранной точки по горизонтали. Настоящие выстрелы: попадания засчитываются, корабли тонут, энергия начисляется.',
    endsTurn: true,
  },
  {
    id: 'torpedo',
    name: 'Торпеда',
    emoji: '🚀',
    cost: 3,
    target: 'enemyLine',
    short: 'Летит до первого попадания',
    description:
      'Идёт вдоль выбранной линии от края и взрывается на первой же корабельной клетке. Промахнуться невозможно — но если на линии пусто, заряд потрачен зря.',
    endsTurn: true,
  },
  {
    id: 'satellite',
    name: 'Спутник',
    emoji: '🛰️',
    cost: 6,
    target: 'enemyBoard',
    short: 'Раскрыть одну клетку с кораблём',
    description:
      'Разведка со спутника указывает одну случайную клетку, где точно стоит корабль. Выстрел не производится — но следующий залп можно не тратить впустую.',
    endsTurn: true,
  },
  {
    id: 'repair',
    name: 'Ремонт',
    emoji: '🛠️',
    cost: 5,
    target: 'ownCell',
    short: 'Залатать пробоину',
    description:
      'Восстанавливает одну подбитую клетку собственного корабля. Потопленный корабль вернуть нельзя — чинить нужно вовремя.',
    endsTurn: true,
  },
  {
    id: 'smoke',
    name: 'Дымзавеса',
    emoji: '🌫️',
    cost: 3,
    target: 'self',
    short: 'Скрыть результат чужих залпов',
    description:
      'На один круг противники перестают видеть, попали они по вам или промахнулись. Урон при этом проходит как обычно — они просто не узнают об этом сразу.',
    endsTurn: true,
  },
  {
    id: 'mine',
    name: 'Мина',
    emoji: '⚓',
    cost: 2,
    target: 'ownCell',
    short: 'Кто попадёт — пропустит ход',
    description:
      'Ставится на пустую клетку своего поля. Соперник, выстреливший в неё, подрывается и пропускает следующий ход. Мина срабатывает один раз.',
    endsTurn: true,
  },
];

export function getAbility(id: string): Ability | undefined {
  return ABILITIES.find((a) => a.id === id);
}

/** Начисление энергии за результат выстрела. */
export const ENERGY_PER_HIT = 1;
export const ENERGY_PER_SUNK = 3;
export const ENERGY_START = 2;

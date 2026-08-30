import type { GameSettings } from './types';

const K = 1000;

export type ModeId = 'classic' | 'blitz' | 'family' | 'tycoon' | 'sprint';

export interface GameMode {
  id: ModeId;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  suggestedBots: number;
  accent: string;
  bullets: string[];
  defaults: Partial<GameSettings>;
}

export const GAME_MODES: GameMode[] = [
  {
    id: 'classic',
    name: 'Классика',
    emoji: '🎩',
    tagline: 'Полные правила, как в коробке.',
    description:
      'Всё по канону: торги за отказ от покупки, залог участков, равномерная застройка, ограниченный запас домов в банке и игра до последнего непобеждённого. Партия идёт столько, сколько нужно.',
    minPlayers: 2,
    maxPlayers: 6,
    suggestedBots: 1,
    accent: '#D4A24C',
    bullets: ['Аукционы за отказ', 'Залог и выкуп', '32 дома и 12 отелей в банке'],
    defaults: {
      startMoney: 1500 * K,
      goSalary: 200 * K,
      goBonus: false,
      auctions: true,
      parkingPot: false,
      mortgages: true,
      tycoon: false,
      roundLimit: 0,
      evenBuild: true,
      houseSupply: 32,
      hotelSupply: 12,
    },
  },
  {
    id: 'blitz',
    name: 'Блиц',
    emoji: '⚡',
    tagline: 'Больше денег, меньше правил, короткая партия.',
    description:
      'Стартовый капитал удвоен, выплата за «Старт» щедрее, торгов нет — отказался от покупки, и участок остаётся банку. Партия заканчивается через пятнадцать кругов, побеждает самый богатый.',
    minPlayers: 2,
    maxPlayers: 6,
    suggestedBots: 1,
    accent: '#38BDF8',
    bullets: ['Старт 3 млн ₽', 'Без аукционов', 'Пятнадцать кругов'],
    defaults: {
      startMoney: 3000 * K,
      goSalary: 300 * K,
      goBonus: false,
      auctions: false,
      parkingPot: false,
      mortgages: true,
      tycoon: false,
      roundLimit: 15,
      evenBuild: false,
      houseSupply: 0,
      hotelSupply: 0,
    },
  },
  {
    id: 'family',
    name: 'Семейная',
    emoji: '🏡',
    tagline: 'Мягкие правила и куш на стоянке.',
    description:
      'Для игры с детьми: щедрый старт, все налоги и штрафы копятся на «Бесплатной стоянке» и достаются тому, кто на неё попадёт, точное попадание на «Старт» удваивает выплату. Ни торгов, ни залогов — только покупка и строительство. Партия длится двенадцать кругов, побеждает самый крупный капитал.',
    minPlayers: 2,
    maxPlayers: 6,
    suggestedBots: 0,
    accent: '#34D399',
    bullets: ['Куш на стоянке', 'Двойная выплата за точный «Старт»', 'Двенадцать кругов'],
    defaults: {
      startMoney: 2500 * K,
      goSalary: 250 * K,
      goBonus: true,
      auctions: false,
      parkingPot: true,
      mortgages: false,
      tycoon: false,
      roundLimit: 12,
      evenBuild: false,
      houseSupply: 0,
      hotelSupply: 0,
    },
  },
  {
    id: 'tycoon',
    name: 'Магнат',
    emoji: '🏙️',
    tagline: 'Небоскрёбы, кредиты и большая застройка.',
    description:
      'Развитие без потолка: поверх отеля можно возвести небоскрёб, который приносит почти вдвое больше. У банка можно взять кредит под проценты, если наличных не хватает на хороший ход. Стартовый капитал урезан — выкручиваться придётся самим.',
    minPlayers: 2,
    maxPlayers: 6,
    suggestedBots: 1,
    accent: '#A78BFA',
    bullets: ['Небоскрёбы поверх отелей', 'Банковские кредиты', 'Скромный старт — 1,2 млн ₽'],
    defaults: {
      startMoney: 1200 * K,
      goSalary: 200 * K,
      goBonus: false,
      auctions: true,
      parkingPot: false,
      mortgages: true,
      tycoon: true,
      roundLimit: 0,
      evenBuild: true,
      houseSupply: 0,
      hotelSupply: 0,
    },
  },
  {
    id: 'sprint',
    name: 'Спринт',
    emoji: '⏱️',
    tagline: 'Восемь кругов. Кто богаче — тот и выиграл.',
    description:
      'Партия на один вечер: ровно восемь кругов, после чего считается всё имущество вместе с наличными. Банкротство не заканчивает игру для остальных — важен итоговый капитал, а не выживание.',
    minPlayers: 2,
    maxPlayers: 6,
    suggestedBots: 2,
    accent: '#FB7185',
    bullets: ['Ровно восемь кругов', 'Побеждает капитал', 'Быстрый темп'],
    defaults: {
      startMoney: 2000 * K,
      goSalary: 250 * K,
      goBonus: false,
      auctions: true,
      parkingPot: true,
      mortgages: true,
      tycoon: false,
      roundLimit: 8,
      evenBuild: false,
      houseSupply: 0,
      hotelSupply: 0,
    },
  },
];

export function getMode(id: string): GameMode {
  return GAME_MODES.find((m) => m.id === id) ?? GAME_MODES[0];
}

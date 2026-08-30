import type { Payoff, PayoffPreset } from './types';

export const PAYOFF_PRESETS: PayoffPreset[] = [
  {
    id: 'classic',
    name: 'Классика',
    emoji: '⚖️',
    description: 'Канонические 3 / 5 / 1 / 0. Идеальный баланс жадности и доверия.',
    payoff: { R: 3, S: 0, T: 5, P: 1 },
  },
  {
    id: 'greedy',
    name: 'Соблазн',
    emoji: '🔥',
    description: 'Предательство приносит вдвое больше. Доверять страшно, но выгодно вместе.',
    payoff: { R: 4, S: 0, T: 8, P: 1 },
  },
  {
    id: 'trust',
    name: 'Доверие',
    emoji: '🤝',
    description: 'Сотрудничество почти всегда окупается. Мягкий режим для семьи и новичков.',
    payoff: { R: 5, S: 1, T: 6, P: 2 },
  },
  {
    id: 'harsh',
    name: 'Жестокий мир',
    emoji: '🥶',
    description: 'Взаимное предательство больно бьёт по обоим. Цена ошибки высока.',
    payoff: { R: 4, S: -2, T: 6, P: -1 },
  },
  {
    id: 'knife',
    name: 'На лезвии',
    emoji: '🗡️',
    description: 'Разница между исходами минимальна — решает не расчёт, а характер.',
    payoff: { R: 3, S: 1, T: 4, P: 2 },
  },
];

export function getPreset(id: string): PayoffPreset {
  return PAYOFF_PRESETS.find((p) => p.id === id) ?? PAYOFF_PRESETS[0];
}

/** Очки за пару ходов: сколько получает игрок с ходом `mine`. */
export function pairScore(mine: 'C' | 'D', theirs: 'C' | 'D', p: Payoff): number {
  if (mine === 'C') return theirs === 'C' ? p.R : p.S;
  return theirs === 'C' ? p.T : p.P;
}

/**
 * «Общее дело»: каждый вкладывает R очков или оставляет их себе.
 * Котёл умножается и делится поровну — классическая игра общественных благ.
 */
export function commonsScore(
  mine: 'C' | 'D',
  cooperators: number,
  total: number,
  p: Payoff,
  multiplier: number,
): number {
  const stake = p.R;
  const pot = cooperators * stake * multiplier;
  const share = total > 0 ? pot / total : 0;
  const kept = mine === 'D' ? stake : 0;
  return Math.round((share + kept) * 10) / 10;
}

/** Проверка, что матрица остаётся дилеммой заключённого. */
export function isValidDilemma(p: Payoff): boolean {
  return p.T > p.R && p.R > p.P && p.P > p.S && 2 * p.R > p.T + p.S;
}

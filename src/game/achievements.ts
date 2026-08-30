import { coopRate } from './engine';
import type { GameState, Player } from './types';

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rarity: 'common' | 'rare' | 'legendary';
  check: (p: Player, state: GameState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'saint',
    name: 'Святой',
    emoji: '😇',
    description: 'Ни одного предательства за всю партию',
    rarity: 'rare',
    check: (p) => p.history.length >= 5 && p.stats.betrayals === 0,
  },
  {
    id: 'serpent',
    name: 'Змей',
    emoji: '🐍',
    description: 'Ни разу не сотрудничал',
    rarity: 'rare',
    check: (p) => p.history.length >= 5 && p.stats.cooperations === 0,
  },
  {
    id: 'mirrorSoul',
    name: 'Зеркальная душа',
    emoji: '🪞',
    description: 'Сотрудничество и предательство ровно поровну',
    rarity: 'common',
    check: (p) => p.history.length >= 6 && p.stats.cooperations === p.stats.betrayals,
  },
  {
    id: 'phoenix',
    name: 'Феникс',
    emoji: '🔥',
    description: 'Вернулся к доверию после трёх предательств подряд',
    rarity: 'rare',
    check: (p) => {
      for (let i = 0; i + 3 < p.history.length; i++) {
        if (p.history.slice(i, i + 3).every((m) => m === 'D') && p.history[i + 3] === 'C') return true;
      }
      return false;
    },
  },
  {
    id: 'champion',
    name: 'Чемпион',
    emoji: '👑',
    description: 'Первое место по очкам',
    rarity: 'common',
    check: (p, s) => {
      const best = Math.max(...s.players.map((x) => x.score));
      return p.score === best && s.players.length > 1;
    },
  },
  {
    id: 'architect',
    name: 'Архитектор доверия',
    emoji: '🏗️',
    description: 'Пять раундов взаимного сотрудничества подряд',
    rarity: 'rare',
    check: (p) => p.stats.longestCoopStreak >= 5,
  },
  {
    id: 'survivor',
    name: 'Стойкий',
    emoji: '🛡️',
    description: 'Предали пять раз и больше, но доля сотрудничества выше половины',
    rarity: 'rare',
    check: (p) => p.stats.betrayed >= 5 && coopRate(p) > 0.5,
  },
  {
    id: 'jackpot',
    name: 'Куш',
    emoji: '💎',
    description: 'Раунд, принёсший 10 и больше очков',
    rarity: 'common',
    check: (p) => p.stats.bestRound >= 10,
  },
  {
    id: 'pacifist',
    name: 'Победа без крови',
    emoji: '🕊️',
    description: 'Выиграл партию, ни разу не предав',
    rarity: 'legendary',
    check: (p, s) => {
      const best = Math.max(...s.players.map((x) => x.score));
      return p.score === best && p.stats.betrayals === 0 && p.history.length >= 6 && s.players.length > 1;
    },
  },
  {
    id: 'harmony',
    name: 'Идеальная гармония',
    emoji: '🌟',
    description: 'В партии был раунд, где сотрудничали абсолютно все',
    rarity: 'common',
    check: (_, s) => s.results.some((r) => r.cooperators === s.players.length),
  },
];

export function evaluateAchievements(state: GameState): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const p of state.players) {
    out[p.id] = ACHIEVEMENTS.filter((a) => a.check(p, state)).map((a) => a.id);
  }
  return out;
}

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

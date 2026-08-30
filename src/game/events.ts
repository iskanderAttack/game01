import type { RoundEventEffect } from './types';

/** Случайные события режима «Хаос». */
export interface GameEvent extends RoundEventEffect {
  /** Множитель очков раунда. */
  scoreMultiplier?: number;
  /** Скрыть чужие ходы при вскрытии. */
  blind?: boolean;
  /** Добавка шума поверх настроек, 0..1. */
  extraNoise?: number;
  /** Бонус каждому, кто сотрудничал. */
  coopBonus?: number;
  /** Штраф каждому, кто предал. */
  defectPenalty?: number;
  /** Все ходы в раунде принудительно одинаковые? (не используется, задел) */
  weight: number;
}

export const GAME_EVENTS: GameEvent[] = [
  {
    id: 'highStakes',
    name: 'Высокие ставки',
    emoji: '💰',
    description: 'Все очки этого раунда удваиваются. Ошибка будет стоить вдвое дороже.',
    scoreMultiplier: 2,
    weight: 3,
  },
  {
    id: 'blackout',
    name: 'Затемнение',
    emoji: '🕶️',
    description: 'Вы узнаете только свой результат — чужие ходы останутся тайной до конца партии.',
    blind: true,
    weight: 2,
  },
  {
    id: 'fog',
    name: 'Туман',
    emoji: '🌫️',
    description: 'Связь барахлит: каждый ход может исказиться в противоположный.',
    extraNoise: 0.25,
    weight: 2,
  },
  {
    id: 'amnesty',
    name: 'Амнистия',
    emoji: '🕊️',
    description: 'Каждый, кто выбрал сотрудничество, получает +2 очка сверху.',
    coopBonus: 2,
    weight: 3,
  },
  {
    id: 'tax',
    name: 'Налог на подлость',
    emoji: '🧾',
    description: 'С каждого предателя удерживается 2 очка. Прокуратура следит за вами.',
    defectPenalty: 2,
    weight: 3,
  },
  {
    id: 'inflation',
    name: 'Инфляция',
    emoji: '📉',
    description: 'Раунд стоит вполовину меньше. Хороший момент, чтобы рискнуть.',
    scoreMultiplier: 0.5,
    weight: 2,
  },
  {
    id: 'jackpot',
    name: 'Джекпот',
    emoji: '🎰',
    description: 'Тройные очки. Один раунд может перевернуть всю партию.',
    scoreMultiplier: 3,
    weight: 1,
  },
  {
    id: 'calm',
    name: 'Затишье',
    emoji: '☕',
    description: 'Обычный раунд без сюрпризов. Отдышитесь.',
    weight: 4,
  },
];

export function rollEvent(rng: () => number): GameEvent {
  const total = GAME_EVENTS.reduce((s, e) => s + e.weight, 0);
  let roll = rng() * total;
  for (const e of GAME_EVENTS) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return GAME_EVENTS[GAME_EVENTS.length - 1];
}

export function getEvent(id: string): GameEvent | undefined {
  return GAME_EVENTS.find((e) => e.id === id);
}

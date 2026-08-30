import type { Move } from './types';

export interface BotContext {
  /** Номер предстоящего раунда, с нуля. */
  round: number;
  totalRounds: number;
  /** Собственные прошлые ходы. */
  selfHistory: Move[];
  /** Ходы конкретного соперника (в парных режимах) либо «поля» целиком. */
  oppHistory: Move[];
  /** Доля кооперации среди всех игроков в прошлом раунде, 0..1. */
  lastCoopRatio: number;
  /** Доля кооперации по раундам. */
  fieldHistory: number[];
  rng: () => number;
}

export interface Strategy {
  id: string;
  name: string;
  emoji: string;
  /** 1 — простая и предсказуемая, 5 — коварная. */
  difficulty: number;
  short: string;
  description: string;
  decide: (ctx: BotContext) => Move;
}

const last = (h: Move[]): Move | undefined => h[h.length - 1];

export const STRATEGIES: Strategy[] = [
  {
    id: 'angel',
    name: 'Ангел',
    emoji: '😇',
    difficulty: 1,
    short: 'Всегда молчит',
    description:
      'Безусловно сотрудничает в каждом раунде. Никогда не мстит и никогда не предаёт. Идеальный напарник и лёгкая добыча.',
    decide: () => 'C',
  },
  {
    id: 'devil',
    name: 'Дьявол',
    emoji: '😈',
    difficulty: 1,
    short: 'Всегда сдаёт',
    description:
      'Предаёт всегда, при любых обстоятельствах. Неуязвим для эксплуатации, но обречён на нищету среди себе подобных.',
    decide: () => 'D',
  },
  {
    id: 'mirror',
    name: 'Зеркало',
    emoji: '🪞',
    difficulty: 3,
    short: 'Повторяет ваш прошлый ход',
    description:
      'Начинает с доверия, дальше просто копирует ваш последний ход. Победитель турнира Аксельрода: добрый, мстительный, прощающий и понятный.',
    decide: (ctx) => last(ctx.oppHistory) ?? 'C',
  },
  {
    id: 'patient',
    name: 'Терпеливый',
    emoji: '🧘',
    difficulty: 3,
    short: 'Мстит после двух предательств',
    description:
      'Прощает одиночную осечку и отвечает ударом только на два предательства подряд. Устойчив к случайным недопониманиям.',
    decide: (ctx) => {
      const h = ctx.oppHistory;
      return h.length >= 2 && h[h.length - 1] === 'D' && h[h.length - 2] === 'D' ? 'D' : 'C';
    },
  },
  {
    id: 'grudger',
    name: 'Злопамятный',
    emoji: '🐘',
    difficulty: 2,
    short: 'Одно предательство — и всё',
    description:
      'Сотрудничает, пока его не предадут. После первого предательства мстит до конца партии. Ничего не забывает и никогда не прощает.',
    decide: (ctx) => (ctx.oppHistory.includes('D') ? 'D' : 'C'),
  },
  {
    id: 'coin',
    name: 'Монетка',
    emoji: '🎲',
    difficulty: 1,
    short: 'Бросает жребий',
    description: 'Каждый раунд выбирает случайно. Просчитать невозможно, но и логики никакой.',
    decide: (ctx) => (ctx.rng() < 0.5 ? 'C' : 'D'),
  },
  {
    id: 'pavlov',
    name: 'Павлов',
    emoji: '🧪',
    difficulty: 4,
    short: 'Выиграл — повторяй, проиграл — меняй',
    description:
      'Если прошлый раунд сложился удачно (оба молчали или он успешно предал), повторяет ход. Если нет — меняет. Быстро находит взаимную выгоду и жёстко наказывает наивных.',
    decide: (ctx) => {
      const me = last(ctx.selfHistory);
      const opp = last(ctx.oppHistory);
      if (!me || !opp) return 'C';
      const good = opp === 'C';
      return good ? me : me === 'C' ? 'D' : 'C';
    },
  },
  {
    id: 'detective',
    name: 'Детектив',
    emoji: '🕵️',
    difficulty: 5,
    short: 'Сначала проверяет вас',
    description:
      'Первые четыре хода — тест: молчать, сдать, молчать, молчать. Если вы ни разу не отомстили, он сядет вам на шею до конца партии. Если отомстили — переключится на честное Зеркало.',
    decide: (ctx) => {
      const probe: Move[] = ['C', 'D', 'C', 'C'];
      if (ctx.round < probe.length) return probe[ctx.round];
      const retaliated = ctx.oppHistory.slice(0, 4).includes('D');
      return retaliated ? last(ctx.oppHistory) ?? 'C' : 'D';
    },
  },
  {
    id: 'kind',
    name: 'Добряк',
    emoji: '🌤️',
    difficulty: 3,
    short: 'Зеркало, которое иногда прощает',
    description:
      'Как Зеркало, но в четверти случаев прощает предательство. Разрывает бесконечные цепочки взаимной мести — особенно ценно, когда ходы искажаются.',
    decide: (ctx) => {
      const opp = last(ctx.oppHistory) ?? 'C';
      if (opp === 'D' && ctx.rng() < 0.25) return 'C';
      return opp;
    },
  },
  {
    id: 'prober',
    name: 'Провокатор',
    emoji: '🎯',
    difficulty: 4,
    short: 'Зеркало с внезапными уколами',
    description:
      'В целом копирует вас, но время от времени вставляет неожиданное предательство — проверяет, будете ли вы терпеть. Будете — станет наглее.',
    decide: (ctx) => {
      if (ctx.round > 0 && ctx.round % 7 === 3) return 'D';
      return last(ctx.oppHistory) ?? 'C';
    },
  },
  {
    id: 'conformist',
    name: 'Конформист',
    emoji: '🐑',
    difficulty: 2,
    short: 'Делает как большинство',
    description:
      'Смотрит, как повело себя большинство в прошлом раунде, и повторяет за ним. В дружном коллективе — ангел, в змеином гнезде — змея.',
    decide: (ctx) => {
      if (ctx.fieldHistory.length === 0) return 'C';
      return ctx.lastCoopRatio >= 0.5 ? 'C' : 'D';
    },
  },
  {
    id: 'shark',
    name: 'Акула',
    emoji: '🦈',
    difficulty: 5,
    short: 'Дружит, пока не почует финал',
    description:
      'Образцовый партнёр большую часть партии — но в последней четверти раундов предаёт всех. Классический «эффект последнего хода».',
    decide: (ctx) => {
      const endgame = ctx.totalRounds > 0 && ctx.round >= Math.floor(ctx.totalRounds * 0.75);
      if (endgame) return 'D';
      return last(ctx.oppHistory) ?? 'C';
    },
  },
];

export function getStrategy(id: string): Strategy {
  return STRATEGIES.find((s) => s.id === id) ?? STRATEGIES[2];
}

/** Наборы ботов по сложности для быстрого старта. */
export const BOT_ROSTERS: Record<string, string[]> = {
  easy: ['angel', 'coin', 'grudger', 'conformist'],
  normal: ['mirror', 'grudger', 'kind', 'coin', 'patient'],
  hard: ['detective', 'pavlov', 'prober', 'shark', 'mirror'],
};

export function pickRoster(kind: keyof typeof BOT_ROSTERS, count: number): string[] {
  const pool = BOT_ROSTERS[kind] ?? BOT_ROSTERS.normal;
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(pool[i % pool.length]);
  return out;
}

import type { GameModeId, GameSettings, StructureId } from './types';

export interface GameMode {
  id: GameModeId;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  /** Как игроки взаимодействуют в раунде. */
  structure: StructureId;
  minPlayers: number;
  maxPlayers: number;
  /** Рекомендуемое число ботов при старте. */
  suggestedBots: number;
  accent: string;
  defaults: Partial<GameSettings>;
  /** Короткие тезисы для карточки режима. */
  bullets: string[];
}

export const GAME_MODES: GameMode[] = [
  {
    id: 'duel',
    name: 'Дуэль',
    emoji: '🎭',
    tagline: 'Двое. Много раундов. Одна репутация.',
    description:
      'Классическая повторяющаяся дилемма один на один. Каждый раунд вы одновременно решаете: молчать или сдать напарника. Память о прошлых раундах — главное оружие.',
    structure: 'pairs',
    minPlayers: 2,
    maxPlayers: 2,
    suggestedBots: 1,
    accent: '#7C5CFF',
    defaults: { rounds: 10, endingRule: 'unknown', events: false },
    bullets: ['Только вдвоём', 'История ходов на виду', 'Побеждает не злоба, а расчёт'],
  },
  {
    id: 'arena',
    name: 'Арена',
    emoji: '⚔️',
    tagline: 'Каждый раунд — новый напарник.',
    description:
      'Игроки разбиваются на пары и меняются каждый раунд. Предал одного — об этом узнают все остальные. Идеально для компании 4–8 человек.',
    structure: 'pairs',
    minPlayers: 3,
    maxPlayers: 12,
    suggestedBots: 0,
    accent: '#FF6B6B',
    defaults: { rounds: 12, endingRule: 'fixed', events: false },
    bullets: ['Ротация пар каждый раунд', 'Репутация важнее одной победы', 'Нечётное число — раунд отдыха'],
  },
  {
    id: 'tournament',
    name: 'Турнир',
    emoji: '🏛️',
    tagline: 'Один выбор — против всех сразу.',
    description:
      'Каждый раунд вы делаете один ход, и он применяется ко всем остальным игрокам одновременно. Нельзя быть добрым к одному и подлым к другому — только честная стратегия.',
    structure: 'roundRobin',
    minPlayers: 3,
    maxPlayers: 12,
    suggestedBots: 2,
    accent: '#FFB020',
    defaults: { rounds: 10, endingRule: 'fixed', events: false },
    bullets: ['Все против всех', 'Один ход на раунд', 'Максимум очков за раунд растёт с числом игроков'],
  },
  {
    id: 'commons',
    name: 'Общее дело',
    emoji: '🌍',
    tagline: 'Вложиться в общий котёл или оставить себе?',
    description:
      'Игра общественных благ для любой компании. Вклады складываются, умножаются и делятся поровну — даже между теми, кто ничего не дал. Общая выгода максимальна, когда вкладываются все.',
    structure: 'commons',
    minPlayers: 3,
    maxPlayers: 16,
    suggestedBots: 0,
    accent: '#2DD4BF',
    defaults: { rounds: 10, endingRule: 'fixed', events: false, commonsMultiplier: 2 },
    bullets: ['Настоящая игра на 3+ игроков', 'Котёл × множитель делится на всех', 'Соблазн проехаться зайцем'],
  },
  {
    id: 'chaos',
    name: 'Хаос',
    emoji: '🌀',
    tagline: 'Правила меняются на ходу.',
    description:
      'Турнир, в который вмешивается судьба: удвоенные ставки, слепые раунды, амнистия, налог на предательство. Стратегии ломаются, начинается веселье.',
    structure: 'roundRobin',
    minPlayers: 3,
    maxPlayers: 12,
    suggestedBots: 1,
    accent: '#F472B6',
    defaults: { rounds: 12, endingRule: 'unknown', events: true, noise: 0.1 },
    bullets: ['Случайное событие каждый раунд', 'Туман недопонимания включён', 'Идеально для вечеринки'],
  },
  {
    id: 'family',
    name: 'Семейный',
    emoji: '🏡',
    tagline: 'Мягкие правила, тёплые формулировки.',
    description:
      'Тот же смысл, но без тюрьмы и предательств: вы вместе печёте пирог. Крупные кнопки, добрые подсказки, короткая партия и щедрая матрица — чтобы играть с детьми.',
    structure: 'commons',
    minPlayers: 2,
    maxPlayers: 10,
    suggestedBots: 0,
    accent: '#34D399',
    defaults: {
      rounds: 8,
      endingRule: 'fixed',
      payoffId: 'trust',
      hints: true,
      events: false,
      noise: 0,
      timer: 0,
    },
    bullets: ['Без страшных слов', 'Щедрая матрица «Доверие»', 'Короткая партия на 8 раундов'],
  },
  {
    id: 'solo',
    name: 'Против ботов',
    emoji: '🤖',
    tagline: 'Двенадцать характеров. Обыграй их всех.',
    description:
      'Вы один против набора классических стратегий: Зеркало, Злопамятный, Провокатор, Павлов и другие. Отличный способ понять, как вообще устроена эта игра.',
    structure: 'roundRobin',
    minPlayers: 1,
    maxPlayers: 8,
    suggestedBots: 3,
    accent: '#60A5FA',
    defaults: { rounds: 15, endingRule: 'fixed', hints: true },
    bullets: ['Играется в одиночку', 'Боты с настоящими стратегиями', 'Разбор вашей стратегии в конце'],
  },
];

export function getMode(id: GameModeId): GameMode {
  return GAME_MODES.find((m) => m.id === id) ?? GAME_MODES[0];
}

/** Словарь названий ходов — в семейном режиме они другие. */
export interface MoveWording {
  coop: string;
  defect: string;
  coopHint: string;
  defectHint: string;
  coopEmoji: string;
  defectEmoji: string;
  title: string;
}

export function wording(modeId: GameModeId): MoveWording {
  if (modeId === 'family') {
    return {
      coop: 'Поделиться',
      defect: 'Забрать себе',
      coopHint: 'Положить свой кусочек в общий пирог',
      defectHint: 'Оставить свой кусочек себе',
      coopEmoji: '🥧',
      defectEmoji: '🍰',
      title: 'Что делаешь?',
    };
  }
  if (modeId === 'commons') {
    return {
      coop: 'Вложить',
      defect: 'Оставить себе',
      coopHint: 'Отправить ставку в общий котёл',
      defectHint: 'Сохранить ставку и получить долю котла',
      coopEmoji: '🪙',
      defectEmoji: '🕳️',
      title: 'Твой вклад',
    };
  }
  return {
    coop: 'Молчать',
    defect: 'Сдать',
    coopHint: 'Держать язык за зубами и надеяться на напарника',
    defectHint: 'Дать показания и попытаться выиграть в одиночку',
    coopEmoji: '🤐',
    defectEmoji: '🗣️',
    title: 'Твой ход',
  };
}

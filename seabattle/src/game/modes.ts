import type { GameSettings } from './types';

export type ModeId = 'classic' | 'blitz' | 'royale' | 'teams' | 'admiral' | 'family' | 'hunt';

/** Как выбирается цель выстрела. */
export type Targeting = 'single' | 'choose';

export interface GameMode {
  id: ModeId;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  targeting: Targeting;
  /** Игроки выбывают, когда флот потоплен. */
  elimination: boolean;
  /** Игроки делятся на команды. */
  teams: boolean;
  /** Рекомендуемое число ботов при старте. */
  suggestedBots: number;
  accent: string;
  bullets: string[];
  defaults: Partial<GameSettings>;
}

export const GAME_MODES: GameMode[] = [
  {
    id: 'classic',
    name: 'Классика',
    emoji: '⚓',
    tagline: 'Двое, десять на десять, попал — стреляй ещё.',
    description:
      'Тот самый морской бой из тетрадки в клетку. Два флота, поочерёдные залпы, попадание даёт право на следующий выстрел. Ничего лишнего — только чутьё и логика.',
    minPlayers: 2,
    maxPlayers: 2,
    targeting: 'single',
    elimination: true,
    teams: false,
    suggestedBots: 1,
    accent: '#38BDF8',
    bullets: ['Классические правила', 'Попал — ходишь снова', 'Корабли не касаются бортами'],
    defaults: { boardSize: 10, fleetId: 'classic', extraTurnOnHit: true, timer: 0, abilities: false },
  },
  {
    id: 'blitz',
    name: 'Блиц',
    emoji: '⚡',
    tagline: 'Двенадцать секунд на залп. Думать некогда.',
    description:
      'Тесное поле, короткий флот и таймер на каждый ход. Попадание не даёт дополнительного выстрела — темп держится сам. Не успел прицелиться — залп уходит наугад.',
    minPlayers: 2,
    maxPlayers: 4,
    targeting: 'choose',
    elimination: true,
    teams: false,
    suggestedBots: 1,
    accent: '#FBBF24',
    bullets: ['Таймер 12 секунд', 'Без дополнительного хода', 'Флот «Дуэль» на поле 6×6'],
    defaults: { boardSize: 8, fleetId: 'small', extraTurnOnHit: false, timer: 12, abilities: false },
  },
  {
    id: 'royale',
    name: 'Королевская битва',
    emoji: '👑',
    tagline: 'Все против всех. Последний на плаву побеждает.',
    description:
      'У каждого своё поле. В свой ход выбираете любого соперника и клетку на его карте. Тот, чей флот утонул, выбывает — но его карта остаётся на виду как назидание остальным. Побеждает последний адмирал.',
    minPlayers: 3,
    maxPlayers: 8,
    targeting: 'choose',
    elimination: true,
    teams: false,
    suggestedBots: 2,
    accent: '#F472B6',
    bullets: ['От трёх до восьми игроков', 'Цель выбираете сами', 'Выбывание по мере потопления'],
    defaults: { boardSize: 8, fleetId: 'small', extraTurnOnHit: true, timer: 0, abilities: false },
  },
  {
    id: 'teams',
    name: 'Эскадры',
    emoji: '🎌',
    tagline: 'Два флота, общая победа.',
    description:
      'Игроки делятся на эскадры. Вы видите карты союзников и их находки, поэтому можно договариваться и делить сектора. Эскадра побеждает, когда потоплены все корабли противника.',
    minPlayers: 4,
    maxPlayers: 8,
    targeting: 'choose',
    elimination: true,
    teams: true,
    suggestedBots: 2,
    accent: '#34D399',
    bullets: ['Две эскадры', 'Карты союзников открыты', 'Разведка общая на команду'],
    defaults: { boardSize: 8, fleetId: 'small', extraTurnOnHit: true, timer: 0, abilities: false },
  },
  {
    id: 'admiral',
    name: 'Адмирал',
    emoji: '🎖️',
    tagline: 'Радары, авиация, торпеды и мины.',
    description:
      'Развёрнутая штабная игра. За попадания копится энергия, её тратят на способности: просветить квадрат радаром, накрыть линию залпом, пустить торпеду, поставить мину на своём поле, залатать пробоину или скрыться в дыму. Обычный выстрел бесплатен всегда.',
    minPlayers: 2,
    maxPlayers: 6,
    targeting: 'choose',
    elimination: true,
    teams: false,
    suggestedBots: 1,
    accent: '#A78BFA',
    bullets: ['Восемь способностей', 'Энергия за попадания', 'Мины и дымовые завесы'],
    defaults: { boardSize: 10, fleetId: 'classic', extraTurnOnHit: true, timer: 0, abilities: true },
  },
  {
    id: 'family',
    name: 'Семейный',
    emoji: '🏡',
    tagline: 'Маленькое поле, крупные клетки, подсказки.',
    description:
      'Поле семь на семь, пять кораблей и добрые подсказки: после промаха игра сама скажет, насколько близко вы были. Никто не выбывает обидно быстро — партия короткая и заканчивается на мажорной ноте.',
    minPlayers: 2,
    maxPlayers: 6,
    targeting: 'choose',
    elimination: true,
    teams: false,
    suggestedBots: 0,
    accent: '#2DD4BF',
    bullets: ['Поле 7×7', 'Подсказки «горячо — холодно»', 'Корабли могут касаться'],
    defaults: {
      boardSize: 7,
      fleetId: 'small',
      allowTouching: true,
      extraTurnOnHit: true,
      hints: true,
      timer: 0,
      abilities: false,
    },
  },
  {
    id: 'hunt',
    name: 'Охота',
    emoji: '🎯',
    tagline: 'Один против флота. Сколько залпов вам нужно?',
    description:
      'Соло-испытание: потопите весь флот за минимальное число выстрелов. Записывается лучший результат. Идеальный способ отработать тактику до того, как садиться играть с людьми.',
    minPlayers: 1,
    maxPlayers: 1,
    targeting: 'single',
    elimination: true,
    teams: false,
    suggestedBots: 1,
    accent: '#FB7185',
    bullets: ['Играется в одиночку', 'Считаются выстрелы', 'Рекорд сохраняется'],
    defaults: { boardSize: 10, fleetId: 'classic', extraTurnOnHit: true, timer: 0, abilities: false },
  },
];

export function getMode(id: string): GameMode {
  return GAME_MODES.find((m) => m.id === id) ?? GAME_MODES[0];
}

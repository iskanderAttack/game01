/** Ход игрока: C — молчать (сотрудничать), D — сдать (предать). */
export type Move = 'C' | 'D';

export type StructureId = 'roundRobin' | 'pairs' | 'commons';
export type GameModeId = 'duel' | 'arena' | 'tournament' | 'commons' | 'chaos' | 'family' | 'solo';
export type EndingRule = 'fixed' | 'unknown';

/** Матрица выплат для парной игры. T > R > P > S и 2R > T + S. */
export interface Payoff {
  /** Reward — оба молчали. */
  R: number;
  /** Sucker — я молчал, он сдал. */
  S: number;
  /** Temptation — я сдал, он молчал. */
  T: number;
  /** Punishment — оба сдали. */
  P: number;
}

export interface PayoffPreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  payoff: Payoff;
}

export interface GameSettings {
  modeId: GameModeId;
  payoffId: string;
  payoff: Payoff;
  /** Запланированное число раундов. */
  rounds: number;
  /** 'unknown' — после minRounds игра может закончиться в любой момент. */
  endingRule: EndingRule;
  /** Вероятность (0..1) завершения каждого раунда при endingRule = 'unknown'. */
  endChance: number;
  /** Шанс, что ход «исказится» — туман недопонимания (0..1). */
  noise: number;
  /** Секунд на ход, 0 — без таймера. */
  timer: number;
  /** Показывать подсказки во время игры. */
  hints: boolean;
  /** Случайные события между раундами. */
  events: boolean;
  /** Скрывать, кто именно как сходил (виден только общий итог). */
  anonymous: boolean;
  /** Множитель общего котла для режима «Общее дело». */
  commonsMultiplier: number;
  sound: boolean;
  haptics: boolean;
  /** Скорость анимации вскрытия: 0.6 — быстро, 1 — обычно, 1.6 — медленно. */
  revealSpeed: number;
}

export interface PlayerStats {
  cooperations: number;
  betrayals: number;
  betrayed: number;
  mutualCoop: number;
  mutualDefect: number;
  bestRound: number;
  longestCoopStreak: number;
  longestDefectStreak: number;
}

export interface Player {
  id: string;
  name: string;
  emoji: string;
  color: string;
  isBot: boolean;
  strategyId?: string;
  /** true — управляется по сети (не на этом устройстве). */
  remote?: boolean;
  score: number;
  history: Move[];
  /** Очки, набранные в каждом раунде. */
  scoreLog: number[];
  stats: PlayerStats;
  achievements: string[];
  connected?: boolean;
}

/** Пара, сыгравшая друг против друга в раунде. */
export interface Pairing {
  a: string;
  b: string;
}

export interface RoundEventEffect {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export interface RoundResult {
  round: number;
  /** Ходы, которые игроки реально выбрали. */
  intents: Record<string, Move>;
  /** Ходы после искажения шумом — именно они пошли в расчёт. */
  moves: Record<string, Move>;
  /** id игроков, чей ход исказился. */
  distorted: string[];
  pairings: Pairing[];
  deltas: Record<string, number>;
  /** Кооператоров в раунде (для «Общего дела» и статистики). */
  cooperators: number;
  event?: RoundEventEffect;
  /** Человекочитаемые строки итога раунда. */
  log: string[];
}

export type Phase =
  | 'setup'
  | 'briefing'
  | 'collecting'
  | 'reveal'
  | 'scoreboard'
  | 'finished';

export interface GameState {
  settings: GameSettings;
  players: Player[];
  round: number;
  totalRounds: number;
  phase: Phase;
  results: RoundResult[];
  /** Ходы текущего раунда: id -> ход. */
  pending: Record<string, Move>;
  /** Индекс игрока, который сейчас ходит в режиме «один телефон». */
  turnIndex: number;
  pairings: Pairing[];
  activeEvent?: RoundEventEffect;
  seed: number;
}

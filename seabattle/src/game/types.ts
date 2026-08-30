export type Orientation = 'h' | 'v';

/** Отметка на клетке поля: по ней ещё не стреляли, промах или попадание. */
export type ShotMark = 0 | 1 | 2;
export const NONE: ShotMark = 0;
export const MISS: ShotMark = 1;
export const HIT: ShotMark = 2;

export interface Coord {
  x: number;
  y: number;
}

/** Роль корабля — влияет на способности в режиме «Адмирал». */
export type ShipRole = 'carrier' | 'battleship' | 'cruiser' | 'destroyer' | 'submarine';

export interface Ship {
  id: string;
  size: number;
  role: ShipRole;
  x: number;
  y: number;
  dir: Orientation;
  /** Попадания по клеткам корабля, от носа к корме. */
  hits: boolean[];
}

export interface Board {
  size: number;
  ships: Ship[];
  /** Все выстрелы по этому полю. */
  shots: ShotMark[][];
  /** Мины, выставленные владельцем поля (режим «Адмирал»). */
  mines: Coord[];
}

/* ─────────────────────── что видит чужой игрок ─────────────────────── */

export interface SunkShipView {
  size: number;
  x: number;
  y: number;
  dir: Orientation;
  role: ShipRole;
}

/** Результат скана радаром: сколько корабельных клеток в квадрате. */
export interface RadarMark {
  x: number;
  y: number;
  size: number;
  count: number;
}

/** Линия, просвеченная авиаразведкой. */
export interface LineMark {
  axis: 'row' | 'col';
  index: number;
  count: number;
}

/** Знания одного игрока о чужом поле. */
export interface Intel {
  radar: RadarMark[];
  /** Клетки, раскрытые спутником: точно корабль. */
  revealed: Coord[];
  lines: LineMark[];
}

export function emptyIntel(): Intel {
  return { radar: [], revealed: [], lines: [] };
}

/** Поле соперника глазами стрелка. */
export interface BoardView {
  size: number;
  shots: ShotMark[][];
  sunk: SunkShipView[];
  shipsLeft: number;
  cellsLeft: number;
  intel: Intel;
}

/* ──────────────────────────── игроки ──────────────────────────── */

export type BotLevel = 'easy' | 'normal' | 'hard';

export interface PlayerStats {
  shots: number;
  hits: number;
  sunk: number;
  /** Ходов, потраченных на способности. */
  abilities: number;
}

export interface Player {
  id: string;
  name: string;
  emoji: string;
  color: string;
  isBot: boolean;
  botLevel?: BotLevel;
  /** Управляется по сети, не на этом устройстве. */
  remote?: boolean;
  /** Номер команды в командном режиме, иначе undefined. */
  team?: number;
  board: Board;
  alive: boolean;
  ready: boolean;
  /** Энергия для способностей режима «Адмирал». */
  energy: number;
  /** Сколько ходов пропустить (подрыв на мине). */
  skipTurns: number;
  /** Ход, до которого результат выстрелов по этому игроку скрыт дымом. */
  smokeUntil: number;
  stats: PlayerStats;
  connected?: boolean;
  /** Знания об остальных: ключ — id соперника. */
  intel: Record<string, Intel>;
}

/* ──────────────────────────── партия ──────────────────────────── */

export type Phase = 'lobby' | 'placement' | 'playing' | 'finished';

export type ShotOutcome = 'miss' | 'hit' | 'sunk' | 'mine' | 'hidden';

export interface ShotRecord {
  turn: number;
  byId: string;
  targetId: string;
  x: number;
  y: number;
  outcome: ShotOutcome;
  /** Название способности, если стреляли не обычным выстрелом. */
  via?: string;
}

export interface GameSettings {
  modeId: string;
  boardSize: number;
  fleetId: string;
  /** Разрешено ли кораблям соприкасаться бортами. */
  allowTouching: boolean;
  /** Попал — стреляешь ещё раз. */
  extraTurnOnHit: boolean;
  /** Секунд на ход, 0 — без таймера. */
  timer: number;
  /** Показывать ли подсказки и «горячо/холодно». */
  hints: boolean;
  /** Способности и энергия (режим «Адмирал»). */
  abilities: boolean;
  sound: boolean;
  haptics: boolean;
  botLevel: BotLevel;
}

export interface GameState {
  settings: GameSettings;
  players: Player[];
  phase: Phase;
  /** Индекс игрока, который сейчас ходит. */
  turnIndex: number;
  /** Порядковый номер хода с начала партии. */
  turn: number;
  log: ShotRecord[];
  winnerIds: string[];
  /** Кого выбрал текущий игрок в качестве цели. */
  targetId: string | null;
  seed: number;
}

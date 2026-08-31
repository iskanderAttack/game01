import type { Outfit } from './wardrobe';

export type TileKind =
  | 'go'
  | 'street'
  | 'rail'
  | 'utility'
  | 'chance'
  | 'chest'
  | 'tax'
  | 'jail'
  | 'parking'
  | 'gotojail';

export type ColorGroup =
  | 'brown'
  | 'lightblue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'blue';

export interface Tile {
  index: number;
  kind: TileKind;
  name: string;
  /** Короткая подпись для клетки на доске. */
  short: string;
  group?: ColorGroup;
  price?: number;
  /** Аренда: без домов, 1 дом, 2, 3, 4, отель. */
  rent?: number[];
  houseCost?: number;
  tax?: number;
  emoji?: string;
}

/** Состояние участка: кому принадлежит, что построено, заложен ли. */
export interface PropertyState {
  ownerId: string | null;
  /** 0–4 дома, 5 — отель, 6 — небоскрёб (режим «Магнат»). */
  houses: number;
  mortgaged: boolean;
}

export interface PlayerStats {
  rolls: number;
  doubles: number;
  rentPaid: number;
  rentEarned: number;
  bought: number;
  jailVisits: number;
  passedGo: number;
}

export interface Player {
  id: string;
  name: string;
  emoji: string;
  color: string;
  /** Зверушка, которой игрок ходит по доске. */
  character: string;
  /** Что на ней надето. На правила не влияет — только внешний вид. */
  outfit: Outfit;
  /** Купленные в этой партии вещи. */
  wardrobe: string[];
  isBot: boolean;
  botLevel?: 'easy' | 'normal' | 'hard';
  remote?: boolean;
  connected?: boolean;
  money: number;
  pos: number;
  inJail: boolean;
  /** Сколько ходов уже просидел в тюрьме. */
  jailTurns: number;
  /** Карточки «Освобождение из тюрьмы». */
  jailCards: number;
  bankrupt: boolean;
  /** Взятые кредиты в режиме «Магнат». */
  loan: number;
  /** Ход, на котором игрок уже предлагал обмен, — чтобы боты не зацикливались. */
  tradedOnTurn: number;
  stats: PlayerStats;
}

/* ─────────────────────────── ход и запросы ─────────────────────────── */

/** Что игрок должен разрешить прямо сейчас. */
export type Prompt =
  | { kind: 'none' }
  | { kind: 'buy'; tile: number; price: number }
  | { kind: 'rent'; tile: number; amount: number; toId: string }
  | { kind: 'tax'; amount: number; label: string }
  | { kind: 'card'; deck: 'chance' | 'chest'; cardId: string; text: string; emoji: string }
  | { kind: 'jail' }
  | { kind: 'debt'; amount: number; toId: string | null };

export type Stage =
  /** Ждём броска кубиков. */
  | 'roll'
  /** Фишка едет по доске. */
  | 'move'
  /** Разбираем клетку: покупка, аренда, карточка. */
  | 'resolve'
  /** Идут торги за участок. */
  | 'auction'
  /** Долг больше наличных — нужно продать или заложить. */
  | 'debt'
  /** Можно строить, торговать и завершать ход. */
  | 'end'
  | 'over';

export interface AuctionState {
  tile: number;
  /** Текущая ставка и кто её сделал. */
  bid: number;
  leaderId: string | null;
  /** Кто ещё в торгах. */
  activeIds: string[];
  /** Чья очередь называть цену. */
  turnId: string;
}

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string;
  giveTiles: number[];
  takeTiles: number[];
  giveMoney: number;
  takeMoney: number;
  giveJailCards: number;
  takeJailCards: number;
}

/**
 * Как фишка попала на свою клетку.
 *
 * Нужно интерфейсу: «walk» проходит по клеткам одну за другой, «jump»
 * (тюрьма, карточки переноса) переносит по дуге. Лежит в состоянии, а не в
 * интерфейсе, чтобы по сети все видели одно и то же движение.
 */
export interface LastMove {
  playerId: string;
  from: number;
  to: number;
  kind: 'walk' | 'jump';
  /** Счётчик — чтобы повтор того же хода не считался «ничего не изменилось». */
  n: number;
}

export interface LogEntry {
  turn: number;
  text: string;
  emoji?: string;
}

export interface GameSettings {
  modeId: string;
  /** Стартовый капитал. */
  startMoney: number;
  /** Выплата за прохождение «Старта». */
  goSalary: number;
  /** Двойная выплата при точном попадании на «Старт». */
  goBonus: boolean;
  /** Отказ от покупки отправляет участок на торги. */
  auctions: boolean;
  /** Штрафы и налоги копятся на «Бесплатной стоянке». */
  parkingPot: boolean;
  /** Разрешён залог участков. */
  mortgages: boolean;
  /** Небоскрёбы и банковские кредиты. */
  tycoon: boolean;
  /** Партия заканчивается после N кругов, побеждает богатейший. 0 — до последнего. */
  roundLimit: number;
  /** Строить можно только равномерно (классическое правило). */
  evenBuild: boolean;
  /** Разное число домов в банке. 0 — без ограничения. */
  houseSupply: number;
  hotelSupply: number;
  sound: boolean;
  haptics: boolean;
  botLevel: 'easy' | 'normal' | 'hard';
}

export interface GameState {
  settings: GameSettings;
  players: Player[];
  /** Состояние всех 40 клеток; для неторгуемых — пустышка. */
  properties: Record<number, PropertyState>;
  turnIndex: number;
  /** Номер хода с начала партии. */
  turn: number;
  /** Полных кругов сделано (по «Старту» лидера очереди). */
  round: number;
  stage: Stage;
  prompt: Prompt;
  dice: [number, number] | null;
  /** Сколько дублей подряд выбросил текущий игрок. */
  doublesInRow: number;
  /** Игрок уже бросал кубики в этом ходу. */
  rolled: boolean;
  auction: AuctionState | null;
  trades: TradeOffer[];
  /** Банк «Бесплатной стоянки». */
  pot: number;
  /** Колоды: перемешанные индексы и текущая позиция. */
  chanceDeck: string[];
  chestDeck: string[];
  chancePos: number;
  chestPos: number;
  log: LogEntry[];
  /** Последнее перемещение фишки — для анимации на доске. */
  lastMove: LastMove | null;
  winnerIds: string[];
  seed: number;
}

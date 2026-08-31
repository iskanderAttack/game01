import { WORLD_EVENTS, getEvent } from './events';

/**
 * Финансовый мир режима «Империя».
 *
 * Круг доски — игровой месяц. На границе месяца выходит новость, двигается
 * ключевая ставка, пересчитываются все цены, начисляются проценты, купоны,
 * дивиденды и арендная плата с зарубежных объектов.
 *
 * Цены меняются РОВНО РАЗ В МЕСЯЦ. Это не упрощение, а правило честности:
 * торговать можно в любой момент, не дожидаясь своего хода, и два игрока,
 * нажавшие «купить» одновременно, получают одну и ту же цену.
 */

export type SectorId = 'fin' | 'tech' | 'med' | 'realty' | 'energy' | 'retail' | 'space' | 'agro';

export interface Sector {
  id: SectorId;
  name: string;
  emoji: string;
  /** Собственный месячный дрейф. */
  drift: number;
  /** Волатильность: разброс месячного результата. */
  sigma: number;
  /** Насколько сектор боится высокой ставки. */
  rateBeta: number;
  /** Дивидендная доходность за квартал. */
  dividend: number;
  /** Месяцы, в которые сектору особенно хорошо. */
  season: number[];
}

export const SECTORS: Sector[] = [
  { id: 'fin', name: 'Финансы', emoji: '🏦', drift: 0.006, sigma: 0.055, rateBeta: 0.2, dividend: 0.022, season: [3, 6, 9, 12] },
  { id: 'tech', name: 'Финтех и IT', emoji: '💳', drift: 0.016, sigma: 0.11, rateBeta: 1.0, dividend: 0.003, season: [9, 10, 11] },
  { id: 'med', name: 'Медицина', emoji: '💊', drift: 0.01, sigma: 0.075, rateBeta: 0.5, dividend: 0.01, season: [1, 2, 11, 12] },
  { id: 'realty', name: 'Недвижимость', emoji: '🏗️', drift: 0.008, sigma: 0.06, rateBeta: 1.1, dividend: 0.018, season: [4, 5, 6] },
  { id: 'energy', name: 'Энергетика', emoji: '⚡', drift: 0.007, sigma: 0.085, rateBeta: 0.35, dividend: 0.025, season: [11, 12, 1, 2] },
  { id: 'retail', name: 'Ритейл', emoji: '🛒', drift: 0.007, sigma: 0.065, rateBeta: 0.6, dividend: 0.017, season: [8, 11, 12] },
  { id: 'space', name: 'Космос и оборона', emoji: '🚀', drift: 0.013, sigma: 0.1, rateBeta: 0.75, dividend: 0.004, season: [5, 6, 7] },
  { id: 'agro', name: 'Агро', emoji: '🌾', drift: 0.006, sigma: 0.07, rateBeta: 0.45, dividend: 0.015, season: [8, 9, 10] },
];

export function sectorOf(id: SectorId): Sector {
  return SECTORS.find((s) => s.id === id) ?? SECTORS[0];
}

/* ───────────────────────────── бумаги ───────────────────────────── */

export interface Stock {
  id: string;
  name: string;
  sector: SectorId;
  start: number;
}

const K = 1000;

export const STOCKS: Stock[] = [
  { id: 'SBER', name: 'Сберегательный', sector: 'fin', start: 28 * K },
  { id: 'VTBK', name: 'Второй банк', sector: 'fin', start: 12 * K },
  { id: 'INSR', name: 'Страховой дом', sector: 'fin', start: 19 * K },

  { id: 'PAYT', name: 'Платёжный круг', sector: 'tech', start: 34 * K },
  { id: 'CLOD', name: 'Облако', sector: 'tech', start: 52 * K },
  { id: 'NEUR', name: 'Нейросети', sector: 'tech', start: 41 * K },

  { id: 'BIOM', name: 'Биомед', sector: 'med', start: 26 * K },
  { id: 'PHRM', name: 'Фармзавод', sector: 'med', start: 17 * K },
  { id: 'CLIN', name: 'Сеть клиник', sector: 'med', start: 22 * K },

  { id: 'DEVL', name: 'Девелопер', sector: 'realty', start: 15 * K },
  { id: 'CMNT', name: 'Цемент', sector: 'realty', start: 9 * K },
  { id: 'REIT', name: 'Арендный фонд', sector: 'realty', start: 21 * K },

  { id: 'OILG', name: 'Нефть и газ', sector: 'energy', start: 31 * K },
  { id: 'GRID', name: 'Энергосети', sector: 'energy', start: 14 * K },
  { id: 'SOLR', name: 'Солнечная', sector: 'energy', start: 11 * K },

  { id: 'MART', name: 'Гипермаркет', sector: 'retail', start: 24 * K },
  { id: 'FOOD', name: 'Доставка еды', sector: 'retail', start: 13 * K },
  { id: 'MODA', name: 'Одежда', sector: 'retail', start: 8 * K },

  { id: 'ORBT', name: 'Орбита', sector: 'space', start: 46 * K },
  { id: 'DRON', name: 'Беспилотники', sector: 'space', start: 29 * K },
  { id: 'SATL', name: 'Спутники', sector: 'space', start: 37 * K },

  { id: 'ZERN', name: 'Зерно', sector: 'agro', start: 10 * K },
  { id: 'MOLK', name: 'Молочный', sector: 'agro', start: 7 * K },
  { id: 'TEPL', name: 'Теплицы', sector: 'agro', start: 12 * K },
];

/* ───────────────────────────── крипта ───────────────────────────── */

export interface Coin {
  id: string;
  name: string;
  emoji: string;
  start: number;
  sigma: number;
  /** Шанс за месяц уйти в ноль. Только у мелких токенов. */
  rug: number;
  major: boolean;
}

export const COINS: Coin[] = [
  { id: 'BTQ', name: 'Битквант', emoji: '₿', start: 640 * K, sigma: 0.22, rug: 0, major: true },
  { id: 'ETR', name: 'Эфирум', emoji: 'Ξ', start: 78 * K, sigma: 0.26, rug: 0, major: true },
  { id: 'SOLA', name: 'Солана', emoji: '◎', start: 21 * K, sigma: 0.32, rug: 0, major: true },
  { id: 'DOGX', name: 'Догикс', emoji: '🐕', start: 1.4 * K, sigma: 0.48, rug: 0.03, major: false },
  { id: 'MEMZ', name: 'Мемзи', emoji: '🐸', start: 0.6 * K, sigma: 0.62, rug: 0.05, major: false },
  { id: 'PUMP', name: 'Пампкоин', emoji: '🚀', start: 0.25 * K, sigma: 0.75, rug: 0.07, major: false },
  { id: 'GRIN', name: 'Гринтокен', emoji: '🌿', start: 2.1 * K, sigma: 0.44, rug: 0.03, major: false },
];

/* ───────────────────────── зарубежная недвижимость ───────────────────────── */

export interface Country {
  id: string;
  name: string;
  flag: string;
  price: number;
  /** Годовая арендная доходность. */
  yield: number;
  sigma: number;
}

export const COUNTRIES: Country[] = [
  { id: 'ae', name: 'Дубай', flag: '🇦🇪', price: 900 * K, yield: 0.07, sigma: 0.05 },
  { id: 'tr', name: 'Стамбул', flag: '🇹🇷', price: 420 * K, yield: 0.08, sigma: 0.07 },
  { id: 'cy', name: 'Лимасол', flag: '🇨🇾', price: 610 * K, yield: 0.055, sigma: 0.04 },
  { id: 'th', name: 'Пхукет', flag: '🇹🇭', price: 350 * K, yield: 0.075, sigma: 0.06 },
  { id: 'ge', name: 'Тбилиси', flag: '🇬🇪', price: 240 * K, yield: 0.09, sigma: 0.065 },
  { id: 'rs', name: 'Белград', flag: '🇷🇸', price: 300 * K, yield: 0.065, sigma: 0.05 },
];

/** Спред: покупаем дороже рынка, продаём дешевле. Так и в жизни. */
export const REALTY_SPREAD = 0.04;
export const STOCK_SPREAD = 0.01;

/* ───────────────────────────── облигации ───────────────────────────── */

export const BOND_FACE = 100 * K;
/** Насколько корпоративный купон выше государственного. */
export const CORP_PREMIUM = 4.5;
/** Шанс дефолта корпоративного выпуска за месяц при спокойном рынке. */
export const CORP_DEFAULT = 0.004;

export interface Bond {
  id: string;
  kind: 'ofz' | 'corp';
  /** Годовой купон в процентах, зафиксированный при покупке. */
  coupon: number;
  qty: number;
}

/**
 * Цена облигации обратна ставке: купон зафиксирован, а рынок требует текущую
 * доходность. Купили под 18 %, ставка упала до 8 — тело выросло вдвое.
 */
export function bondPrice(coupon: number, keyRate: number): number {
  return Math.round((BOND_FACE * coupon) / Math.max(2, keyRate));
}

/* ───────────────────────────── стартапы ───────────────────────────── */

export interface Startup {
  id: string;
  sector: SectorId;
  name: string;
  invested: number;
  valuation: number;
  /** Сколько раундов уже поднято. */
  rounds: number;
  months: number;
  state: 'alive' | 'dead' | 'public';
  /** Тикер после выхода на биржу. */
  ticker?: string;
}

/* ───────────────────────────── портфель ───────────────────────────── */

export interface Holding {
  qty: number;
  /** Средняя цена покупки — по ней считается прибыль. */
  avg: number;
}

export interface Portfolio {
  /** Акции и монеты в одной таблице: тикер → позиция. */
  positions: Record<string, Holding>;
  bonds: Bond[];
  /** Срочный вклад: выше процент, досрочное снятие теряет месяц. */
  term: number;
  /** До востребования: ниже процент, снимается свободно. */
  demand: number;
  /** Страна → сколько объектов. */
  realty: Record<string, number>;
  startups: Startup[];
  /** Накоплено процентов по срочному вкладу в текущем месяце. */
  termAccrued: number;
}

export function emptyPortfolio(): Portfolio {
  return {
    positions: {},
    bonds: [],
    term: 0,
    demand: 0,
    realty: {},
    startups: [],
    termAccrued: 0,
  };
}

/* ───────────────────────────── состояние рынка ───────────────────────────── */

export interface ActiveEvent {
  id: string;
  /** Сколько месяцев эффект ещё действует. */
  left: number;
  total: number;
}

/** Бумага, появившаяся из стартапа после IPO. */
export interface IpoTicker {
  id: string;
  name: string;
  sector: SectorId;
}

export interface MarketState {
  month: number;
  year: number;
  /** Ключевая ставка ЦБ в процентах. */
  keyRate: number;
  /** Тикер → текущая цена. Акции, монеты и вышедшие на биржу стартапы. */
  prices: Record<string, number>;
  /** Последние восемь значений для графика. */
  history: Record<string, number[]>;
  /** Индекс цен по странам: 1 — как на старте. */
  realty: Record<string, number>;
  events: ActiveEvent[];
  /** Последние новости, свежая первой. */
  news: string[];
  deck: string[];
  deckPos: number;
  ipo: IpoTicker[];
}

export const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export const SEASONS = [
  { name: 'Зима', emoji: '❄️' },
  { name: 'Весна', emoji: '🌱' },
  { name: 'Лето', emoji: '☀️' },
  { name: 'Осень', emoji: '🍂' },
];

export function seasonOf(month: number) {
  if (month === 12 || month <= 2) return SEASONS[0];
  if (month <= 5) return SEASONS[1];
  if (month <= 8) return SEASONS[2];
  return SEASONS[3];
}

export const RATE_MIN = 4;
export const RATE_MAX = 20;

/** Ставка по срочному вкладу. */
export const termRate = (keyRate: number) => Math.max(1, keyRate - 1.5);
/** Ставка до востребования — вдвое скромнее. */
export const demandRate = (keyRate: number) => Math.max(0.5, keyRate / 2 - 1);
/** Купон нового выпуска ОФЗ. */
export const ofzCoupon = (keyRate: number) => Math.max(3, keyRate - 0.5);

export function createMarket(): MarketState {
  const prices: Record<string, number> = {};
  const history: Record<string, number[]> = {};
  for (const s of STOCKS) {
    prices[s.id] = s.start;
    history[s.id] = [s.start];
  }
  for (const c of COINS) {
    prices[c.id] = c.start;
    history[c.id] = [c.start];
  }
  const realty: Record<string, number> = {};
  for (const c of COUNTRIES) realty[c.id] = 1;

  return {
    month: 1,
    year: 1,
    keyRate: 9,
    prices,
    history,
    realty,
    events: [],
    news: [],
    deck: shuffleIds(),
    deckPos: 0,
    ipo: [],
  };
}

function shuffleIds(): string[] {
  const ids = WORLD_EVENTS.map((x) => x.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

/* ───────────────────────────── смена месяца ───────────────────────────── */

/** Сумма эффектов действующих событий по сектору, с затуханием. */
export function sectorShock(market: MarketState, sector: SectorId): number {
  let sum = 0;
  for (const a of market.events) {
    const w = a.left / a.total;
    sum += (getEvent(a.id).sectors[sector] ?? 0) * w;
  }
  return sum;
}

function shockOf(market: MarketState, key: 'crypto' | 'realty'): number {
  let sum = 0;
  for (const a of market.events) {
    const w = a.left / a.total;
    sum += getEvent(a.id)[key] * w;
  }
  return sum;
}

/** Куда события тянут ставку. */
function ratePull(market: MarketState): number {
  let sum = 0;
  for (const a of market.events) sum += getEvent(a.id).rate * (a.left / a.total);
  return sum;
}

function gauss(): number {
  // Приближение Бокса — Мюллера, обрезанное, чтобы не улетали хвосты.
  const u = Math.max(1e-9, Math.random());
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(-2.5, Math.min(2.5, z));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface MonthReport {
  /** Новость месяца. */
  eventId: string;
  keyRate: number;
  month: number;
  year: number;
}

/**
 * Прокрутить месяц: вытянуть новость, сдвинуть ставку, пересчитать цены.
 * Начисления игрокам делает движок — здесь только мир.
 */
export function advanceMonth(market: MarketState): MonthReport {
  market.month += 1;
  if (market.month > 12) {
    market.month = 1;
    market.year += 1;
  }

  // Действующие события стареют, отжившие уходят.
  market.events = market.events
    .map((a) => ({ ...a, left: a.left - 1 }))
    .filter((a) => a.left > 0);

  // Новость месяца.
  if (market.deckPos >= market.deck.length) {
    market.deck = shuffleIds();
    market.deckPos = 0;
  }
  const eventId = market.deck[market.deckPos++];
  const event = getEvent(eventId);
  market.events.push({ id: eventId, left: event.months, total: event.months });
  market.news = [eventId, ...market.news].slice(0, 6);

  /* Ставка идёт к цели, заданной событиями, шагами не больше двух пунктов.
     Цель считается от нынешнего уровня, а не от «нормы»: два ястребиных
     месяца подряд действительно уводят ставку к потолку, а не гасят друг
     друга — иначе качели, ради которых всё затевалось, не раскачиваются. */
  const target = clamp(market.keyRate * 0.82 + 9 * 0.18 + ratePull(market), RATE_MIN, RATE_MAX);
  const step = clamp(target - market.keyRate, -2, 2);
  market.keyRate = clamp(Math.round((market.keyRate + step) * 4) / 4, RATE_MIN, RATE_MAX);

  const rateGap = market.keyRate - 9;
  const crypto = shockOf(market, 'crypto');

  // Акции.
  const tickers: Array<{ id: string; sector: SectorId; sigma: number }> = [
    ...STOCKS.map((s) => ({ id: s.id, sector: s.sector, sigma: sectorOf(s.sector).sigma })),
    ...market.ipo.map((s) => ({ id: s.id, sector: s.sector, sigma: sectorOf(s.sector).sigma * 1.5 })),
  ];

  for (const t of tickers) {
    const s = sectorOf(t.sector);
    const seasonal = s.season.includes(market.month) ? 0.02 : 0;
    const r =
      s.drift +
      sectorShock(market, t.sector) +
      seasonal -
      (rateGap * s.rateBeta) / 100 +
      t.sigma * gauss();
    market.prices[t.id] = Math.max(100, Math.round(market.prices[t.id] * Math.exp(r)));
    push(market.history, t.id, market.prices[t.id]);
  }

  // Крипта: своя жизнь, к ставке почти безразлична, но событиям послушна.
  for (const c of COINS) {
    if (market.prices[c.id] <= 0) continue;
    if (!c.major && Math.random() < c.rug) {
      market.prices[c.id] = 1;
      push(market.history, c.id, 1);
      continue;
    }
    const r = 0.004 + crypto - (rateGap * 0.4) / 100 + c.sigma * gauss();
    market.prices[c.id] = Math.max(1, Math.round(market.prices[c.id] * Math.exp(r)));
    push(market.history, c.id, market.prices[c.id]);
  }

  // Зарубежная недвижимость.
  const realtyShock = shockOf(market, 'realty');
  for (const c of COUNTRIES) {
    const r = 0.004 + realtyShock - (rateGap * 0.5) / 100 + c.sigma * gauss();
    market.realty[c.id] = Math.max(0.25, market.realty[c.id] * Math.exp(r));
  }

  return { eventId, keyRate: market.keyRate, month: market.month, year: market.year };
}

function push(history: Record<string, number[]>, id: string, value: number) {
  const row = history[id] ?? [];
  row.push(value);
  history[id] = row.slice(-8);
}

/* ───────────────────────────── оценка ───────────────────────────── */

export function realtyPrice(market: MarketState, countryId: string): number {
  const c = COUNTRIES.find((x) => x.id === countryId);
  if (!c) return 0;
  return Math.round(c.price * (market.realty[countryId] ?? 1));
}

/** Во что оценивается всё, что игрок держит на рынке. */
export function portfolioValue(market: MarketState, p: Portfolio): number {
  let sum = p.term + p.demand + p.termAccrued;

  for (const [id, h] of Object.entries(p.positions)) {
    sum += (market.prices[id] ?? 0) * h.qty;
  }
  for (const b of p.bonds) {
    sum += bondPrice(b.coupon, market.keyRate) * b.qty;
  }
  for (const [country, n] of Object.entries(p.realty)) {
    sum += realtyPrice(market, country) * n;
  }
  for (const s of p.startups) {
    // Доля в живом стартапе — актив неликвидный, считаем с дисконтом.
    if (s.state === 'alive') sum += Math.round(s.valuation * 0.5);
  }
  return Math.round(sum);
}

export function nameOf(id: string, market?: MarketState): string {
  const stock = STOCKS.find((s) => s.id === id);
  if (stock) return stock.name;
  const coin = COINS.find((c) => c.id === id);
  if (coin) return coin.name;
  const ipo = market?.ipo.find((s) => s.id === id);
  if (ipo) return ipo.name;
  return id;
}

export function sectorFor(id: string, market?: MarketState): SectorId | null {
  const stock = STOCKS.find((s) => s.id === id);
  if (stock) return stock.sector;
  const ipo = market?.ipo.find((s) => s.id === id);
  if (ipo) return ipo.sector;
  return null;
}

/** Изменение цены за последний месяц, в долях. */
export function changeOf(market: MarketState, id: string): number {
  const row = market.history[id];
  if (!row || row.length < 2) return 0;
  const prev = row[row.length - 2];
  if (!prev) return 0;
  return (row[row.length - 1] - prev) / prev;
}

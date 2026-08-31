import {
  sectorOf,
  sectorShock,
  type MarketState,
  type Portfolio,
  type SectorId,
  type Startup,
} from './market';

/**
 * Стартапы и IPO.
 *
 * Каждый месяц у живого стартапа считаются три вероятности: умереть, поднять
 * раунд и выйти на биржу. На них влияют «жар» сектора (его двигают мировые
 * события), ключевая ставка (дешёвые деньги — больше раундов) и то, сколько
 * денег вложил основатель.
 *
 * Шансы честно показываются в интерфейсе: это ставка с открытыми правилами,
 * а не лотерея вслепую.
 */

const NAMES: Record<SectorId, string[]> = {
  fin: ['Копилка', 'Ставка', 'Расчёт', 'Депозитор', 'Кошелёк'],
  tech: ['Битрейт', 'Кодерра', 'Нейрон', 'Сигнал', 'Пиксель'],
  med: ['Пульс', 'Ланцет', 'Геном', 'Ремедиум', 'Витамин'],
  realty: ['Квадрат', 'Новосёл', 'Этаж', 'Фундамент', 'Каркас'],
  energy: ['Ватт', 'Турбина', 'Искра', 'Реактор', 'Контур'],
  retail: ['Полка', 'Корзина', 'Витрина', 'Пакет', 'Прилавок'],
  space: ['Апогей', 'Вектор', 'Ступень', 'Орбита', 'Зенит'],
  agro: ['Колос', 'Грядка', 'Пасека', 'Урожай', 'Теплица'],
};

const SUFFIX = ['Лаб', 'Про', 'Тех', 'Групп', 'Плюс', 'Икс'];

let counter = 0;

export function foundStartup(sector: SectorId, amount: number): Startup {
  const pool = NAMES[sector];
  const name = `${pool[Math.floor(Math.random() * pool.length)]} ${
    SUFFIX[Math.floor(Math.random() * SUFFIX.length)]
  }`;
  return {
    id: `su${Date.now().toString(36)}${(counter++).toString(36)}`,
    sector,
    name,
    invested: amount,
    // Основатель заходит по оценке вдвое выше вложенного — так устроен рынок.
    valuation: Math.round(amount * 2),
    rounds: 0,
    months: 0,
    state: 'alive',
  };
}

/** Минимальный чек, ниже которого затея не взлетит. */
export const STARTUP_MIN = 150000;

export interface StartupOdds {
  die: number;
  round: number;
  ipo: number;
}

/**
 * «Жар» сектора: единица — обычные времена, больше — деньги льются рекой.
 * Складывается из новостей и дешевизны денег.
 */
export function heatOf(market: MarketState, sector: SectorId): number {
  const news = sectorShock(market, sector) * 3;
  const cheapMoney = (11 - market.keyRate) / 45;
  return Math.max(0.35, 1 + news + cheapMoney);
}

export function oddsFor(market: MarketState, s: Startup): StartupOdds {
  if (s.state !== 'alive') return { die: 0, round: 0, ipo: 0 };

  const heat = heatOf(market, s.sector);
  const sector = sectorOf(s.sector);
  // Хорошо профинансированный стартап живёт дольше — но не бесконечно.
  const cushion = Math.min(0.06, s.invested / Math.max(1, s.valuation) * 0.12);

  const die = clamp((0.11 - s.rounds * 0.02 - cushion) / heat, 0.015, 0.3);
  const round = clamp((0.22 + s.rounds * 0.015 + sector.drift * 4) * heat, 0.05, 0.46);
  const ipo = s.rounds >= 3 ? clamp((0.07 + (s.rounds - 3) * 0.05) * heat, 0, 0.38) : 0;

  return { die, round, ipo };
}

export interface StartupNews {
  startup: Startup;
  kind: 'died' | 'round' | 'ipo';
  /** Деньги, которые получил владелец (при IPO — стоимость пакета). */
  amount: number;
  ticker?: string;
}

/**
 * Прокрутить месяц по всем стартапам портфеля.
 * Возвращает события, о которых стоит рассказать игроку.
 */
export function tickStartups(market: MarketState, p: Portfolio, ownerName: string): StartupNews[] {
  const news: StartupNews[] = [];

  for (const s of p.startups) {
    if (s.state !== 'alive') continue;
    s.months += 1;

    const odds = oddsFor(market, s);
    const roll = Math.random();

    if (roll < odds.die) {
      s.state = 'dead';
      s.valuation = 0;
      news.push({ startup: s, kind: 'died', amount: 0 });
      continue;
    }

    if (roll < odds.die + odds.ipo) {
      const ticker = ipoTicker(market, s, ownerName);
      s.state = 'public';
      s.ticker = ticker;
      // Доля превращается в обычные акции: тысяча бумаг по цене оценки.
      const price = Math.max(100, Math.round(s.valuation / 1000));
      market.prices[ticker] = price;
      market.history[ticker] = [price];
      const pos = p.positions[ticker] ?? { qty: 0, avg: price };
      p.positions[ticker] = {
        qty: pos.qty + 1000,
        avg: Math.round((pos.avg * pos.qty + price * 1000) / (pos.qty + 1000)),
      };
      news.push({ startup: s, kind: 'ipo', amount: price * 1000, ticker });
      continue;
    }

    if (roll < odds.die + odds.ipo + odds.round) {
      const multiple = 1.4 + Math.random() * 0.8;
      s.valuation = Math.round(s.valuation * multiple);
      s.rounds += 1;
      news.push({ startup: s, kind: 'round', amount: s.valuation });
    }
  }

  return news;
}

function ipoTicker(market: MarketState, s: Startup, ownerName: string): string {
  const base = translit(s.name).slice(0, 4).toUpperCase() || 'IPOX';
  let id = base;
  let n = 1;
  while (market.prices[id] !== undefined) id = `${base}${n++}`;
  market.ipo.push({ id, name: `${s.name} (${ownerName})`, sector: s.sector });
  return id;
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'z', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'c', ш: 's', щ: 's', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'u', я: 'a',
};

function translit(text: string): string {
  return [...text.toLowerCase()]
    .map((ch) => TRANSLIT[ch] ?? (/[a-z0-9]/.test(ch) ? ch : ''))
    .join('');
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

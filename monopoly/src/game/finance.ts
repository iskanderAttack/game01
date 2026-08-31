import {
  BOND_FACE,
  COINS,
  CORP_DEFAULT,
  CORP_PREMIUM,
  COUNTRIES,
  REALTY_SPREAD,
  STOCKS,
  STOCK_SPREAD,
  bondPrice,
  demandRate,
  nameOf,
  ofzCoupon,
  realtyPrice,
  sectorOf,
  termRate,
  type MarketState,
  type Portfolio,
  type SectorId,
} from './market';
import { STARTUP_MIN, foundStartup, tickStartups } from './startups';
import { money } from './money';

/**
 * Операции с финансовыми инструментами.
 *
 * Все они разрешены ВНЕ очереди хода: следить за своими деньгами можно
 * когда угодно, не дожидаясь кубиков. Честность обеспечивает то, что цены
 * меняются ровно раз в игровой месяц — одновременные сделки идут по одной
 * и той же цене.
 */

export type FinOp =
  | { op: 'buy'; id: string; qty: number }
  | { op: 'sell'; id: string; qty: number }
  | { op: 'deposit'; kind: 'term' | 'demand'; amount: number }
  | { op: 'withdraw'; kind: 'term' | 'demand'; amount: number }
  | { op: 'buyBond'; kind: 'ofz' | 'corp'; qty: number }
  /** Выпуск продаётся целиком — дробить лоты в игре ни к чему. */
  | { op: 'sellBond'; bondId: string }
  | { op: 'buyRealty'; country: string }
  | { op: 'sellRealty'; country: string }
  | { op: 'found'; sector: SectorId; amount: number }
  | { op: 'fund'; startupId: string; amount: number }
  | { op: 'exit'; startupId: string };

export interface FinResult {
  error?: string;
  /** Что записать в журнал партии. */
  log?: { text: string; emoji: string };
}

let bondCounter = 0;

export function applyFinance(
  market: MarketState,
  p: Portfolio,
  wallet: { money: number; name: string },
  action: FinOp,
): FinResult {
  switch (action.op) {
    /* ── бумаги и монеты ── */
    case 'buy': {
      const price = market.prices[action.id];
      if (!price) return { error: 'Такой бумаги нет' };
      const qty = Math.floor(action.qty);
      if (qty <= 0) return { error: 'Сколько покупаем?' };
      const cost = Math.round(price * qty * (1 + STOCK_SPREAD));
      if (cost > wallet.money) return { error: 'Не хватает денег' };

      wallet.money -= cost;
      const pos = p.positions[action.id] ?? { qty: 0, avg: price };
      p.positions[action.id] = {
        qty: pos.qty + qty,
        avg: Math.round((pos.avg * pos.qty + price * qty) / (pos.qty + qty)),
      };
      return { log: { text: `${wallet.name} покупает ${nameOf(action.id, market)}`, emoji: '📈' } };
    }

    case 'sell': {
      const price = market.prices[action.id];
      const pos = p.positions[action.id];
      if (!price || !pos) return { error: 'Такой позиции нет' };
      const qty = Math.min(Math.floor(action.qty), pos.qty);
      if (qty <= 0) return { error: 'Нечего продавать' };

      const gain = Math.round(price * qty * (1 - STOCK_SPREAD));
      wallet.money += gain;
      if (pos.qty === qty) delete p.positions[action.id];
      else p.positions[action.id] = { ...pos, qty: pos.qty - qty };

      const profit = Math.round((price - pos.avg) * qty);
      return {
        log: {
          text: `${wallet.name} продаёт ${nameOf(action.id, market)}: ${
            profit >= 0 ? '+' : '−'
          }${money(Math.abs(profit))}`,
          emoji: profit >= 0 ? '💹' : '📉',
        },
      };
    }

    /* ── вклады ── */
    case 'deposit': {
      const amount = Math.floor(action.amount);
      if (amount <= 0) return { error: 'Какую сумму кладём?' };
      if (amount > wallet.money) return { error: 'Не хватает денег' };
      wallet.money -= amount;
      if (action.kind === 'term') p.term += amount;
      else p.demand += amount;
      return {
        log: {
          text: `${wallet.name} кладёт ${money(amount)} на ${
            action.kind === 'term' ? 'срочный вклад' : 'счёт до востребования'
          }`,
          emoji: '🏦',
        },
      };
    }

    case 'withdraw': {
      const pot = action.kind === 'term' ? p.term : p.demand;
      const amount = Math.min(Math.floor(action.amount), pot);
      if (amount <= 0) return { error: 'Снимать нечего' };

      if (action.kind === 'term') {
        // Досрочное снятие съедает проценты, начисленные в этом месяце.
        const share = amount / Math.max(1, p.term);
        const penalty = Math.round(p.termAccrued * share);
        p.term -= amount;
        p.termAccrued -= penalty;
        wallet.money += amount - penalty;
        return {
          log: {
            text: penalty > 0
              ? `${wallet.name} снимает вклад досрочно, теряя ${money(penalty)}`
              : `${wallet.name} снимает ${money(amount)} со вклада`,
            emoji: '🏧',
          },
        };
      }

      p.demand -= amount;
      wallet.money += amount;
      return { log: { text: `${wallet.name} снимает ${money(amount)}`, emoji: '🏧' } };
    }

    /* ── облигации ── */
    case 'buyBond': {
      const qty = Math.floor(action.qty);
      if (qty <= 0) return { error: 'Сколько бумаг?' };
      const coupon =
        action.kind === 'ofz' ? ofzCoupon(market.keyRate) : ofzCoupon(market.keyRate) + CORP_PREMIUM;
      const cost = bondPrice(coupon, market.keyRate) * qty;
      if (cost > wallet.money) return { error: 'Не хватает денег' };

      wallet.money -= cost;
      p.bonds.push({
        id: `b${Date.now().toString(36)}${(bondCounter++).toString(36)}`,
        kind: action.kind,
        coupon: Math.round(coupon * 100) / 100,
        qty,
      });
      return {
        log: {
          text: `${wallet.name} покупает ${
            action.kind === 'ofz' ? 'ОФЗ' : 'корпоративные облигации'
          } под ${coupon.toFixed(1)} %`,
          emoji: '📜',
        },
      };
    }

    case 'sellBond': {
      const idx = p.bonds.findIndex((b) => b.id === action.bondId);
      if (idx < 0) return { error: 'Такого выпуска нет' };
      const bond = p.bonds[idx];
      const gain = bondPrice(bond.coupon, market.keyRate) * bond.qty;
      wallet.money += gain;
      p.bonds.splice(idx, 1);
      return { log: { text: `${wallet.name} продаёт облигации за ${money(gain)}`, emoji: '📜' } };
    }

    /* ── зарубежная недвижимость ── */
    case 'buyRealty': {
      const c = COUNTRIES.find((x) => x.id === action.country);
      if (!c) return { error: 'Такой страны нет' };
      const cost = Math.round(realtyPrice(market, c.id) * (1 + REALTY_SPREAD));
      if (cost > wallet.money) return { error: 'Не хватает денег' };
      wallet.money -= cost;
      p.realty[c.id] = (p.realty[c.id] ?? 0) + 1;
      return { log: { text: `${wallet.name} покупает жильё: ${c.flag} ${c.name}`, emoji: '🌍' } };
    }

    case 'sellRealty': {
      const c = COUNTRIES.find((x) => x.id === action.country);
      if (!c || !p.realty[c.id]) return { error: 'Там ничего нет' };
      const gain = Math.round(realtyPrice(market, c.id) * (1 - REALTY_SPREAD));
      wallet.money += gain;
      p.realty[c.id] -= 1;
      if (p.realty[c.id] <= 0) delete p.realty[c.id];
      return {
        log: { text: `${wallet.name} продаёт жильё в ${c.name} за ${money(gain)}`, emoji: '🌍' },
      };
    }

    /* ── стартапы ── */
    case 'found': {
      const amount = Math.floor(action.amount);
      if (amount < STARTUP_MIN) return { error: `Минимальный чек — ${money(STARTUP_MIN)}` };
      if (amount > wallet.money) return { error: 'Не хватает денег' };
      if (p.startups.filter((s) => s.state === 'alive').length >= 3) {
        return { error: 'Больше трёх стартапов сразу не потянуть' };
      }
      wallet.money -= amount;
      const startup = foundStartup(action.sector, amount);
      p.startups.push(startup);
      return {
        log: {
          text: `${wallet.name} основывает «${startup.name}» (${sectorOf(action.sector).name})`,
          emoji: '🚀',
        },
      };
    }

    case 'fund': {
      const s = p.startups.find((x) => x.id === action.startupId);
      if (!s || s.state !== 'alive') return { error: 'Стартап недоступен' };
      const amount = Math.floor(action.amount);
      if (amount <= 0) return { error: 'Сколько вкладываем?' };
      if (amount > wallet.money) return { error: 'Не хватает денег' };
      wallet.money -= amount;
      s.invested += amount;
      s.valuation += Math.round(amount * 1.5);
      return { log: { text: `${wallet.name} докладывает в «${s.name}»`, emoji: '💼' } };
    }

    case 'exit': {
      const s = p.startups.find((x) => x.id === action.startupId);
      if (!s || s.state !== 'alive') return { error: 'Стартап недоступен' };
      // Долю в непубличной компании берут со скидкой — покупателей мало.
      const gain = Math.round(s.valuation * 0.45);
      wallet.money += gain;
      s.state = 'dead';
      s.valuation = 0;
      return {
        log: { text: `${wallet.name} продаёт долю в «${s.name}» за ${money(gain)}`, emoji: '🤝' },
      };
    }

    default:
      return { error: 'Неизвестная операция' };
  }
}

/* ───────────────────────── начисления за месяц ───────────────────────── */

export interface MonthEarnings {
  interest: number;
  coupons: number;
  dividends: number;
  rent: number;
  notes: string[];
}

/**
 * Проценты, купоны, дивиденды, аренда и судьба стартапов за прошедший месяц.
 * Вызывается движком сразу после смены месяца.
 */
export function settleMonth(
  market: MarketState,
  p: Portfolio,
  wallet: { money: number; name: string },
): MonthEarnings {
  const out: MonthEarnings = { interest: 0, coupons: 0, dividends: 0, rent: 0, notes: [] };

  /* Вклады — сложный процент помесячно. */
  if (p.term > 0) {
    const gain = Math.round((p.term * termRate(market.keyRate)) / 1200);
    p.term += gain;
    p.termAccrued = gain;
    out.interest += gain;
  } else {
    p.termAccrued = 0;
  }
  if (p.demand > 0) {
    const gain = Math.round((p.demand * demandRate(market.keyRate)) / 1200);
    p.demand += gain;
    out.interest += gain;
  }

  /* Купоны, изредка — дефолт по корпоративным. */
  const survived = [];
  for (const b of p.bonds) {
    if (b.kind === 'corp' && Math.random() < CORP_DEFAULT * (market.keyRate > 14 ? 3 : 1)) {
      out.notes.push('корпоративный выпуск объявил дефолт');
      continue;
    }
    out.coupons += Math.round((BOND_FACE * b.coupon * b.qty) / 1200);
    survived.push(b);
  }
  p.bonds = survived;

  /* Дивиденды — раз в квартал. */
  if (market.month % 3 === 0) {
    for (const [id, h] of Object.entries(p.positions)) {
      const stock = STOCKS.find((s) => s.id === id);
      if (!stock) continue;
      out.dividends += Math.round((market.prices[id] ?? 0) * h.qty * sectorOf(stock.sector).dividend);
    }
  }

  /* Аренда с зарубежных объектов. */
  for (const [country, n] of Object.entries(p.realty)) {
    const c = COUNTRIES.find((x) => x.id === country);
    if (!c) continue;
    out.rent += Math.round((realtyPrice(market, country) * c.yield * n) / 12);
  }

  /* Мусорные токены иногда обнуляются — позиция становится пылью. */
  for (const coin of COINS) {
    const pos = p.positions[coin.id];
    if (pos && market.prices[coin.id] <= 1 && pos.avg > 100) {
      out.notes.push(`${coin.name} обнулился`);
    }
  }

  const startupNews = tickStartups(market, p, wallet.name);
  for (const n of startupNews) {
    if (n.kind === 'died') out.notes.push(`«${n.startup.name}» не выжил`);
    if (n.kind === 'round') out.notes.push(`«${n.startup.name}» поднял раунд`);
    if (n.kind === 'ipo') out.notes.push(`«${n.startup.name}» вышел на биржу`);
  }

  wallet.money += out.interest + out.coupons + out.dividends + out.rent;
  return out;
}

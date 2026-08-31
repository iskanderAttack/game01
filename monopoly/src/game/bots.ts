import {
  SECTORS,
  STOCKS,
  changeOf,
  sectorShock,
  type SectorId,
} from './market';
import { JAIL_FEE, groupTiles, isBuyable } from './board';
import {
  buildCost,
  canBuild,
  canMortgage,
  countOwned,
  netWorth,
  ownedTiles,
  ownsGroup,
  playerById,
  tileAt,
  type Action,
} from './engine';
import type { ColorGroup, GameState, TradeOffer } from './types';

const K = 1000;

export const BOT_LEVELS = [
  {
    id: 'easy' as const,
    name: 'Новичок',
    emoji: '🙂',
    description: 'Покупает через раз, строит редко и легко расстаётся с деньгами.',
  },
  {
    id: 'normal' as const,
    name: 'Делец',
    emoji: '💼',
    description: 'Считает наличные, собирает цветные группы и вовремя строит дома.',
  },
  {
    id: 'hard' as const,
    name: 'Магнат',
    emoji: '🎩',
    description:
      'Держит запас наличных, охотится за оранжевыми и красными улицами, торгуется на аукционах до последнего и застраивает группы целиком.',
  },
];

/** Сколько наличных бот старается держать про запас. */
function reserve(level: string): number {
  if (level === 'easy') return 50 * K;
  if (level === 'hard') return 350 * K;
  return 200 * K;
}

/**
 * Ценность участка для бота.
 *
 * Оранжевые и красные улицы стоят дороже своей цены: на них чаще всего
 * попадают после тюрьмы. Участок, замыкающий группу, ценнее вдвойне.
 */
function valueOf(state: GameState, botId: string, tileIndex: number): number {
  const tile = tileAt(tileIndex);
  const price = tile.price ?? 0;
  let value = price;

  const hot: ColorGroup[] = ['orange', 'red'];
  if (tile.group && hot.includes(tile.group)) value *= 1.35;
  if (tile.kind === 'rail') value *= 1.2;

  if (tile.group) {
    const group = groupTiles(tile.group);
    const mine = countOwned(state, botId, group);
    if (mine === group.length - 1) value *= 2.2;
    else if (mine > 0) value *= 1.4;
  }

  return Math.round(value);
}

/** Следующее действие бота или null, если ходить нечем. */
export function botAction(state: GameState, botId: string): Action | null {
  const bot = playerById(state, botId);
  if (!bot || bot.bankrupt) return null;
  const level = bot.botLevel ?? 'normal';
  const keep = reserve(level);

  /* Торги идут вне очереди. */
  if (state.stage === 'auction' && state.auction) {
    const a = state.auction;
    if (a.turnId !== botId) return null;
    const worth = valueOf(state, botId, a.tile);
    const ceiling = level === 'easy' ? worth * 0.7 : level === 'hard' ? worth * 1.15 : worth * 0.95;
    const step = Math.max(20 * K, Math.round(worth * 0.1));
    const next = a.bid + step;
    if (next <= ceiling && next <= bot.money - keep / 2) return { t: 'bid', amount: next };
    return { t: 'pass' };
  }

  if (state.players[state.turnIndex]?.id !== botId) return null;

  /* Долг: продаём постройки, закладываем участки, иначе банкротство. */
  if (state.stage === 'debt' && state.prompt.kind === 'debt') {
    const need = state.prompt.amount - bot.money;
    if (need <= 0) return null;

    const withHouses = ownedTiles(state, botId)
      .filter((i) => state.properties[i].houses > 0)
      .sort((a, b) => state.properties[b].houses - state.properties[a].houses);
    if (withHouses.length > 0) return { t: 'sellHouse', tile: withHouses[0] };

    const mortgageable = ownedTiles(state, botId)
      .filter((i) => canMortgage(state, botId, i) === null)
      .sort((a, b) => (tileAt(a).price ?? 0) - (tileAt(b).price ?? 0));
    if (mortgageable.length > 0) return { t: 'mortgage', tile: mortgageable[0] };

    if (state.settings.tycoon && bot.loan === 0) {
      const limit = Math.max(0, Math.round(netWorth(state, botId) / 2));
      if (limit >= need) return { t: 'loan', amount: need };
    }

    return { t: 'bankrupt' };
  }

  /* Тюрьма. */
  if (bot.inJail && (state.stage === 'resolve' || state.stage === 'roll')) {
    if (bot.jailCards > 0) return { t: 'jailCard' };
    // Ближе к концу партии сидеть выгодно: аренда не грозит.
    const rich = bot.money > keep + JAIL_FEE * 2;
    if (rich && bot.jailTurns < 3) return { t: 'jailPay' };
    return { t: 'jailRoll' };
  }

  if (state.stage === 'roll') return { t: 'roll' };

  /* Разбор клетки. */
  if (state.stage === 'resolve') {
    const prompt = state.prompt;

    if (prompt.kind === 'buy') {
      const worth = valueOf(state, botId, prompt.tile);
      const affordable = bot.money - prompt.price >= keep;
      const wants =
        level === 'easy'
          ? Math.random() < 0.62
          : worth >= prompt.price * (level === 'hard' ? 0.9 : 1);
      if (affordable && wants) return { t: 'buy' };
      // На дешёвый участок соглашаемся даже без запаса.
      if (bot.money >= prompt.price && prompt.price <= 150 * K) return { t: 'buy' };
      return { t: 'decline' };
    }

    if (prompt.kind === 'jail') {
      if (bot.jailCards > 0) return { t: 'jailCard' };
      return bot.money > keep + JAIL_FEE ? { t: 'jailPay' } : { t: 'jailRoll' };
    }

    return { t: 'ack' };
  }

  /* Стройка, обмен и завершение хода. */
  if (state.stage === 'end') {
    if (level !== 'easy' || Math.random() < 0.5) {
      const build = pickBuild(state, botId, keep);
      if (build !== null) return { t: 'build', tile: build };
    }
    if (bot.loan > 0 && bot.money > keep + bot.loan) return { t: 'repay', amount: bot.loan };

    // Без обмена цветные группы почти никогда не собираются, и партия
    // превращается в бесконечную беготню по кругу.
    if (level !== 'easy') {
      const offer = proposeTrade(state, botId, keep);
      if (offer) return { t: 'trade', offer };
    }

    return { t: 'endTurn' };
  }

  return null;
}

/** Ответ бота на входящее предложение обмена. */
export function botTradeReply(state: GameState, botId: string): Action | null {
  const bot = playerById(state, botId);
  if (!bot || bot.bankrupt) return null;

  const offer = state.trades.find((t) => t.toId === botId);
  if (!offer) return null;

  const from = playerById(state, offer.fromId);
  if (!from) return { t: 'tradeRespond', id: offer.id, accept: false };

  // Считаем ценность обеих сторон сделки своими глазами.
  const gain =
    offer.giveTiles.reduce((sum, i) => sum + valueOf(state, botId, i), 0) + offer.giveMoney;
  const loss =
    offer.takeTiles.reduce((sum, i) => sum + valueOf(state, botId, i), 0) + offer.takeMoney;

  if (offer.takeMoney > bot.money - reserve(bot.botLevel ?? 'normal')) {
    return { t: 'tradeRespond', id: offer.id, accept: false };
  }

  // Отдавать участок, замыкающий чужую группу, можно только за очень большие деньги.
  const completesTheirGroup = offer.takeTiles.some((i) => {
    const tile = tileAt(i);
    if (!tile.group) return false;
    const group = groupTiles(tile.group);
    return group.every((g) => g === i || state.properties[g].ownerId === from.id);
  });
  const threshold = completesTheirGroup ? 1.8 : 1.1;

  return { t: 'tradeRespond', id: offer.id, accept: gain >= loss * threshold };
}

/**
 * Ищет участок, замыкающий цветную группу бота, и предлагает за него
 * щедрую сумму: собранная группа окупает переплату за пару кругов.
 */
function proposeTrade(state: GameState, botId: string, keep: number): Omit<TradeOffer, 'id'> | null {
  const bot = playerById(state, botId);
  if (!bot) return null;
  // Одно предложение за ход: иначе бот бесконечно торгуется сам с собой
  // и никогда не доходит до завершения хода.
  if (bot.tradedOnTurn === state.turn) return null;
  if (state.trades.some((t) => t.fromId === botId)) return null;

  for (const tileIndex of Object.keys(state.properties).map(Number)) {
    const tile = tileAt(tileIndex);
    if (!tile.group || !isBuyable(tile)) continue;

    const ownerId = state.properties[tileIndex].ownerId;
    if (!ownerId || ownerId === botId) continue;
    const owner = playerById(state, ownerId);
    if (!owner || owner.bankrupt) continue;

    const group = groupTiles(tile.group);
    const mineInGroup = group.filter((g) => state.properties[g].ownerId === botId).length;
    if (mineInGroup !== group.length - 1) continue;
    if (state.properties[tileIndex].houses > 0) continue;

    // Замыкающий участок стоит куда дороже своей цены: с ним группа
    // начинает приносить втрое больше. Предлагаем столько, чтобы
    // владельцу было выгодно согласиться.
    const offerMoney = Math.round(valueOf(state, botId, tileIndex) * 1.3);
    if (bot.money - offerMoney < keep) continue;

    return {
      fromId: botId,
      toId: ownerId,
      giveTiles: [],
      takeTiles: [tileIndex],
      giveMoney: offerMoney,
      takeMoney: 0,
      giveJailCards: 0,
      takeJailCards: 0,
    };
  }

  return null;
}

/** Куда бот вложится в этот ход. */
function pickBuild(state: GameState, botId: string, keep: number): number | null {
  const bot = playerById(state, botId);
  if (!bot) return null;

  const candidates = ownedTiles(state, botId)
    .filter((i) => {
      const tile = tileAt(i);
      if (!tile.group) return false;
      if (!ownsGroup(state, botId, tile.group)) return false;
      return canBuild(state, botId, i) === null;
    })
    .filter((i) => bot.money - buildCost(state, i) >= keep);

  if (candidates.length === 0) return null;

  // Сначала самые доходные группы, внутри группы — самый отстающий участок.
  candidates.sort((a, b) => {
    const ha = state.properties[a].houses;
    const hb = state.properties[b].houses;
    if (ha !== hb) return ha - hb;
    return (tileAt(b).rent?.[3] ?? 0) - (tileAt(a).rent?.[3] ?? 0);
  });

  return candidates[0];
}

/* ─────────────────────────── рынок в «Империи» ───────────────────────────
   Боты играют на понятной стратегии, а не наугад: при высокой ставке уходят
   во вклады и облигации, при низкой — в акции сектора, которому сейчас
   помогают новости. «Магнат» вдобавок заводит один стартап. */

export function botFinance(state: GameState, botId: string): Action | null {
  const market = state.market;
  const bot = playerById(state, botId);
  if (!market || !bot || bot.bankrupt) return null;
  // Одно решение за ход — иначе бот зациклится на бирже.
  if (bot.investedOnTurn === state.turn) return null;

  const level = bot.botLevel ?? 'normal';
  if (level === 'easy' && Math.random() < 0.45) return null;

  const p = bot.portfolio;
  const keep = reserve(level) + 150 * K;
  const free = bot.money - keep;
  const inDebt = state.stage === 'debt' && state.players[state.turnIndex]?.id === botId;

  /* Нечем платить — распродаём нажитое, начиная с самого ликвидного. */
  if (bot.money < 150 * K || inDebt) {
    if (p.demand > 0) {
      return { t: 'fin', op: { op: 'withdraw', kind: 'demand', amount: p.demand } };
    }
    const position = Object.entries(p.positions)[0];
    if (position) {
      return { t: 'fin', op: { op: 'sell', id: position[0], qty: position[1].qty } };
    }
    if (p.bonds.length > 0) {
      return { t: 'fin', op: { op: 'sellBond', bondId: p.bonds[0].id } };
    }
    if (p.term > 0) {
      return { t: 'fin', op: { op: 'withdraw', kind: 'term', amount: p.term } };
    }
    return null;
  }

  if (free < 150 * K) return null;

  const highRate = market.keyRate >= 12;

  /* Высокая ставка — деньги должны лежать в банке, а не в акциях. */
  if (highRate) {
    // Сначала выйти из подешевевших акций.
    const loser = Object.entries(p.positions).find(([id]) => changeOf(market, id) < -0.08);
    if (loser && Math.random() < 0.5) {
      return { t: 'fin', op: { op: 'sell', id: loser[0], qty: loser[1].qty } };
    }
    if (Math.random() < 0.45 && free > 400 * K) {
      return { t: 'fin', op: { op: 'buyBond', kind: level === 'hard' ? 'corp' : 'ofz', qty: 2 } };
    }
    return { t: 'fin', op: { op: 'deposit', kind: 'term', amount: Math.floor(free * 0.6) } };
  }

  /* Низкая ставка — вклад бессмыслен, деньги идут в дело. */
  if (p.term > 0 && market.keyRate <= 7) {
    return { t: 'fin', op: { op: 'withdraw', kind: 'term', amount: p.term } };
  }

  if (level === 'hard' && p.startups.filter((s) => s.state === 'alive').length === 0 && free > 700 * K) {
    const sector = hottestSector(state);
    return { t: 'fin', op: { op: 'found', sector, amount: Math.floor(free * 0.3) } };
  }

  const pick = bestTicker(state);
  if (!pick) return null;
  const price = market.prices[pick];
  const qty = Math.floor((free * 0.45) / Math.max(1, price));
  if (qty < 1) return null;
  return { t: 'fin', op: { op: 'buy', id: pick, qty } };
}

/** Сектор, которому сейчас больше всего помогают новости. */
function hottestSector(state: GameState): SectorId {
  const market = state.market!;
  let best: SectorId = 'tech';
  let top = -Infinity;
  for (const s of SECTORS) {
    const score = sectorShock(market, s.id) + s.drift;
    if (score > top) {
      top = score;
      best = s.id;
    }
  }
  return best;
}

/** Бумага с лучшим сочетанием импульса и попутного ветра новостей. */
function bestTicker(state: GameState): string | null {
  const market = state.market!;
  let best: string | null = null;
  let top = -Infinity;
  for (const stock of STOCKS) {
    const score = sectorShock(market, stock.sector) * 2 + changeOf(market, stock.id);
    if (score > top) {
      top = score;
      best = stock.id;
    }
  }
  return best;
}

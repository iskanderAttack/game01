import {
  BOARD,
  BOARD_SIZE,
  GO_TO_JAIL_INDEX,
  JAIL_FEE,
  JAIL_INDEX,
  RAIL_RENT,
  RAIL_TILES,
  SKYSCRAPER_COST_FACTOR,
  SKYSCRAPER_RENT_FACTOR,
  UTILITY_MULTIPLIER,
  UTILITY_TILES,
  groupTiles,
  isBuyable,
} from './board';
import { CHANCE, CHEST, getCard, type Card } from './cards';
import { money } from './money';
import { getMode } from './modes';
import type {
  ColorGroup,
  GameSettings,
  GameState,
  LogEntry,
  Player,
  PropertyState,
  Prompt,
  Tile,
  TradeOffer,
} from './types';

/* ─────────────────────────── действия игрока ─────────────────────────── */

export type Action =
  | { t: 'roll' }
  | { t: 'buy' }
  | { t: 'decline' }
  | { t: 'ack' }
  | { t: 'bid'; amount: number }
  | { t: 'pass' }
  | { t: 'build'; tile: number }
  | { t: 'sellHouse'; tile: number }
  | { t: 'mortgage'; tile: number }
  | { t: 'unmortgage'; tile: number }
  | { t: 'jailPay' }
  | { t: 'jailCard' }
  | { t: 'jailRoll' }
  | { t: 'loan'; amount: number }
  | { t: 'repay'; amount: number }
  | { t: 'trade'; offer: Omit<TradeOffer, 'id'> }
  | { t: 'tradeRespond'; id: string; accept: boolean }
  | { t: 'bankrupt' }
  | { t: 'endTurn' };

export interface ActionResult {
  state: GameState;
  error?: string;
}

/* ───────────────────────────── помощники ───────────────────────────── */

export const tileAt = (i: number): Tile => BOARD[((i % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE];

export function currentPlayer(state: GameState): Player | null {
  return state.players[state.turnIndex] ?? null;
}

export function playerById(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id);
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.bankrupt);
}

function clone(state: GameState): GameState {
  return {
    ...state,
    settings: { ...state.settings },
    players: state.players.map((p) => ({ ...p, stats: { ...p.stats } })),
    properties: Object.fromEntries(
      Object.entries(state.properties).map(([k, v]) => [k, { ...v }]),
    ) as Record<number, PropertyState>,
    trades: state.trades.map((t) => ({ ...t })),
    chanceDeck: [...state.chanceDeck],
    chestDeck: [...state.chestDeck],
    log: [...state.log],
    winnerIds: [...state.winnerIds],
    auction: state.auction ? { ...state.auction, activeIds: [...state.auction.activeIds] } : null,
  };
}

function say(state: GameState, text: string, emoji?: string) {
  state.log.unshift({ turn: state.turn, text, emoji });
  if (state.log.length > 60) state.log.pop();
}

const shuffled = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Владеет ли игрок всей цветной группой. */
export function ownsGroup(state: GameState, playerId: string, group: ColorGroup): boolean {
  return groupTiles(group).every((i) => state.properties[i]?.ownerId === playerId);
}

export function countOwned(state: GameState, playerId: string, tiles: number[]): number {
  return tiles.filter((i) => state.properties[i]?.ownerId === playerId).length;
}

/** Стоимость постройки следующего уровня на участке. */
export function buildCost(state: GameState, tileIndex: number): number {
  const tile = tileAt(tileIndex);
  const base = tile.houseCost ?? 0;
  const prop = state.properties[tileIndex];
  // Небоскрёб поверх отеля стоит вдвое дороже обычного этажа.
  return prop && prop.houses >= 5 ? base * SKYSCRAPER_COST_FACTOR : base;
}

/** Максимальный уровень застройки: отель или небоскрёб в режиме «Магнат». */
export function maxHouses(state: GameState): number {
  return state.settings.tycoon ? 6 : 5;
}

/** Сколько домов и отелей уже стоит на доске. */
function builtCounts(state: GameState): { houses: number; hotels: number } {
  let houses = 0;
  let hotels = 0;
  for (const p of Object.values(state.properties)) {
    if (p.houses >= 5) hotels += 1;
    else houses += p.houses;
  }
  return { houses, hotels };
}

/** Аренда участка с учётом монополии, застройки и броска кубиков. */
export function rentFor(state: GameState, tileIndex: number, diceSum: number): number {
  const tile = tileAt(tileIndex);
  const prop = state.properties[tileIndex];
  if (!prop || !prop.ownerId || prop.mortgaged) return 0;

  if (tile.kind === 'rail') {
    const owned = countOwned(state, prop.ownerId, RAIL_TILES);
    return RAIL_RENT[owned] ?? 0;
  }

  if (tile.kind === 'utility') {
    const owned = countOwned(state, prop.ownerId, UTILITY_TILES);
    return diceSum * (UTILITY_MULTIPLIER[owned] ?? 0) * 1000;
  }

  if (tile.kind === 'street' && tile.rent && tile.group) {
    if (prop.houses === 0) {
      // Полная группа без застройки — аренда удваивается.
      return ownsGroup(state, prop.ownerId, tile.group) ? tile.rent[0] * 2 : tile.rent[0];
    }
    if (prop.houses >= 6) return Math.round(tile.rent[5] * SKYSCRAPER_RENT_FACTOR);
    return tile.rent[prop.houses];
  }

  return 0;
}

/** Всё имущество игрока в деньгах — для итогов и оценки ботами. */
export function netWorth(state: GameState, playerId: string): number {
  let total = playerById(state, playerId)?.money ?? 0;
  total -= playerById(state, playerId)?.loan ?? 0;

  for (const [key, prop] of Object.entries(state.properties)) {
    if (prop.ownerId !== playerId) continue;
    const tile = tileAt(Number(key));
    const price = tile.price ?? 0;
    total += prop.mortgaged ? Math.round(price / 2) : price;
    if (prop.houses > 0) {
      const cost = tile.houseCost ?? 0;
      const levels = Math.min(prop.houses, 5);
      total += levels * cost;
      if (prop.houses >= 6) total += cost * SKYSCRAPER_COST_FACTOR;
    }
  }
  return total;
}

export function ownedTiles(state: GameState, playerId: string): number[] {
  return Object.entries(state.properties)
    .filter(([, p]) => p.ownerId === playerId)
    .map(([k]) => Number(k));
}

/* ─────────────────────────── создание партии ─────────────────────────── */

export function makePlayer(init: Partial<Player> & { id: string; name: string }): Player {
  return {
    emoji: '🎩',
    color: '#D4A24C',
    isBot: false,
    money: 0,
    pos: 0,
    inJail: false,
    jailTurns: 0,
    jailCards: 0,
    bankrupt: false,
    loan: 0,
    tradedOnTurn: -1,
    stats: { rolls: 0, doubles: 0, rentPaid: 0, rentEarned: 0, bought: 0, jailVisits: 0, passedGo: 0 },
    ...init,
  };
}

export function createGame(settings: GameSettings, roster: Player[]): GameState {
  const properties: Record<number, PropertyState> = {};
  for (const tile of BOARD) {
    if (isBuyable(tile)) properties[tile.index] = { ownerId: null, houses: 0, mortgaged: false };
  }

  const state: GameState = {
    settings: { ...settings },
    players: roster.map((p) => ({
      ...makePlayer({ id: p.id, name: p.name }),
      ...p,
      money: settings.startMoney,
      pos: 0,
      inJail: false,
      jailTurns: 0,
      jailCards: 0,
      bankrupt: false,
      loan: 0,
      tradedOnTurn: -1,
      stats: { rolls: 0, doubles: 0, rentPaid: 0, rentEarned: 0, bought: 0, jailVisits: 0, passedGo: 0 },
    })),
    properties,
    turnIndex: 0,
    turn: 1,
    round: 1,
    stage: 'roll',
    prompt: { kind: 'none' },
    dice: null,
    doublesInRow: 0,
    rolled: false,
    auction: null,
    trades: [],
    pot: 0,
    chanceDeck: shuffled(CHANCE.map((c) => c.id)),
    chestDeck: shuffled(CHEST.map((c) => c.id)),
    chancePos: 0,
    chestPos: 0,
    log: [],
    winnerIds: [],
    seed: Math.floor(Math.random() * 2 ** 31),
  };

  say(state, `Партия началась. У каждого ${money(settings.startMoney)}.`, '🎲');
  return state;
}

/* ─────────────────────────── денежные операции ─────────────────────────── */

/** Переводит деньги. Если не хватает — включает режим поиска средств. */
function pay(state: GameState, fromId: string, toId: string | null, amount: number): boolean {
  const from = playerById(state, fromId);
  if (!from || amount <= 0) return true;

  if (from.money < amount) {
    state.stage = 'debt';
    state.prompt = { kind: 'debt', amount, toId };
    return false;
  }

  from.money -= amount;
  if (toId) {
    const to = playerById(state, toId);
    if (to) {
      to.money += amount;
      to.stats.rentEarned += amount;
    }
  } else if (state.settings.parkingPot) {
    // Штрафы и налоги в семейном режиме копятся на стоянке.
    state.pot += amount;
  }
  return true;
}

function receive(state: GameState, playerId: string, amount: number) {
  const p = playerById(state, playerId);
  if (p) p.money += amount;
}

/* ─────────────────────────── перемещение ─────────────────────────── */

function moveTo(state: GameState, player: Player, tile: number, collectGo: boolean) {
  const before = player.pos;
  const target = ((tile % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  if (collectGo && target < before) passGo(state, player);
  player.pos = target;
}

function passGo(state: GameState, player: Player) {
  player.money += state.settings.goSalary;
  player.stats.passedGo += 1;
  say(state, `${player.name} проходит «Старт»: ${money(state.settings.goSalary)}`, '🏁');
}

function sendToJail(state: GameState, player: Player) {
  player.pos = JAIL_INDEX;
  player.inJail = true;
  player.jailTurns = 0;
  player.stats.jailVisits += 1;
  state.doublesInRow = 0;
  say(state, `${player.name} отправляется в тюрьму`, '🚔');
}

/* ─────────────────────────── обработка клетки ─────────────────────────── */

function landOn(state: GameState, player: Player) {
  const tile = tileAt(player.pos);
  const diceSum = state.dice ? state.dice[0] + state.dice[1] : 0;

  if (tile.kind === 'gotojail') {
    sendToJail(state, player);
    finishSegment(state, true);
    return;
  }

  if (tile.kind === 'go' && state.settings.goBonus) {
    receive(state, player.id, state.settings.goSalary);
    say(state, `${player.name} точно на «Старте» — выплата удваивается`, '🎯');
  }

  if (tile.kind === 'parking' && state.settings.parkingPot && state.pot > 0) {
    receive(state, player.id, state.pot);
    say(state, `${player.name} забирает куш со стоянки: ${money(state.pot)}`, '🅿️');
    state.pot = 0;
  }

  if (tile.kind === 'tax' && tile.tax) {
    state.stage = 'resolve';
    state.prompt = { kind: 'tax', amount: tile.tax, label: tile.name };
    return;
  }

  if (tile.kind === 'chance' || tile.kind === 'chest') {
    const card = drawCard(state, tile.kind);
    state.stage = 'resolve';
    state.prompt = { kind: 'card', deck: tile.kind, cardId: card.id, text: card.text, emoji: card.emoji };
    return;
  }

  if (isBuyable(tile)) {
    const prop = state.properties[tile.index];
    if (!prop.ownerId) {
      state.stage = 'resolve';
      state.prompt = { kind: 'buy', tile: tile.index, price: tile.price ?? 0 };
      return;
    }
    if (prop.ownerId !== player.id && !prop.mortgaged) {
      const amount = rentFor(state, tile.index, diceSum);
      if (amount > 0) {
        state.stage = 'resolve';
        state.prompt = { kind: 'rent', tile: tile.index, amount, toId: prop.ownerId };
        return;
      }
    }
  }

  finishSegment(state, false);
}

/**
 * Завершает отрезок хода: либо даёт бросить ещё раз за дубль,
 * либо переводит игрока в стадию строительства и завершения.
 */
function finishSegment(state: GameState, forceEnd: boolean) {
  state.prompt = { kind: 'none' };
  const player = currentPlayer(state);
  if (!player) return;

  if (!forceEnd && state.doublesInRow > 0 && !player.inJail) {
    state.stage = 'roll';
    state.rolled = false;
    return;
  }
  state.stage = 'end';
}

function drawCard(state: GameState, deck: 'chance' | 'chest'): Card {
  const ids = deck === 'chance' ? state.chanceDeck : state.chestDeck;
  const pos = deck === 'chance' ? state.chancePos : state.chestPos;
  const id = ids[pos % ids.length];
  if (deck === 'chance') state.chancePos = (pos + 1) % ids.length;
  else state.chestPos = (pos + 1) % ids.length;
  return getCard(id)!;
}

function applyCard(state: GameState, player: Player, card: Card) {
  const e = card.effect;
  say(state, `${player.name}: ${card.text}`, card.emoji);

  switch (e.t) {
    case 'money':
      if (e.amount >= 0) receive(state, player.id, e.amount);
      else if (!pay(state, player.id, null, -e.amount)) return;
      break;

    case 'moveTo':
      moveTo(state, player, e.tile, e.collectGo);
      landOn(state, player);
      return;

    case 'moveBy': {
      const next = player.pos + e.steps;
      player.pos = ((next % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
      landOn(state, player);
      return;
    }

    case 'jail':
      sendToJail(state, player);
      finishSegment(state, true);
      return;

    case 'jailCard':
      player.jailCards += 1;
      break;

    case 'nearestRail': {
      const target = nearest(player.pos, RAIL_TILES);
      if (target < player.pos) passGo(state, player);
      player.pos = target;
      const prop = state.properties[target];
      if (prop?.ownerId && prop.ownerId !== player.id && !prop.mortgaged) {
        const amount = rentFor(state, target, 0) * 2;
        state.stage = 'resolve';
        state.prompt = { kind: 'rent', tile: target, amount, toId: prop.ownerId };
        return;
      }
      landOn(state, player);
      return;
    }

    case 'nearestUtility': {
      const target = nearest(player.pos, UTILITY_TILES);
      if (target < player.pos) passGo(state, player);
      player.pos = target;
      const prop = state.properties[target];
      if (prop?.ownerId && prop.ownerId !== player.id && !prop.mortgaged) {
        const roll = 1 + Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6);
        const amount = roll * 10 * 1000;
        state.stage = 'resolve';
        state.prompt = { kind: 'rent', tile: target, amount, toId: prop.ownerId };
        return;
      }
      landOn(state, player);
      return;
    }

    case 'repairs': {
      let total = 0;
      for (const i of ownedTiles(state, player.id)) {
        const p = state.properties[i];
        if (p.houses >= 5) total += e.perHotel;
        else total += p.houses * e.perHouse;
      }
      if (total > 0 && !pay(state, player.id, null, total)) return;
      if (total > 0) say(state, `${player.name} тратит на ремонт ${money(total)}`, '🔧');
      break;
    }

    case 'payEach': {
      const others = activePlayers(state).filter((p) => p.id !== player.id);
      const total = e.amount * others.length;
      if (!pay(state, player.id, null, total)) return;
      // Деньги ушли банку, раздаём их вручную.
      state.pot -= state.settings.parkingPot ? total : 0;
      for (const o of others) o.money += e.amount;
      break;
    }

    case 'collectEach': {
      for (const o of activePlayers(state).filter((p) => p.id !== player.id)) {
        if (o.money >= e.amount) {
          o.money -= e.amount;
          player.money += e.amount;
        } else {
          player.money += o.money;
          o.money = 0;
        }
      }
      break;
    }
  }

  finishSegment(state, false);
}

function nearest(from: number, targets: number[]): number {
  for (let step = 1; step <= BOARD_SIZE; step++) {
    const candidate = (from + step) % BOARD_SIZE;
    if (targets.includes(candidate)) return candidate;
  }
  return targets[0];
}

/* ─────────────────────────── смена хода ─────────────────────────── */

function nextTurn(state: GameState) {
  state.dice = null;
  state.doublesInRow = 0;
  state.rolled = false;
  state.prompt = { kind: 'none' };
  state.auction = null;

  const total = state.players.length;
  for (let step = 1; step <= total; step++) {
    const idx = (state.turnIndex + step) % total;
    if (state.players[idx].bankrupt) continue;
    if (idx <= state.turnIndex) state.round += 1;
    state.turnIndex = idx;
    state.turn += 1;
    break;
  }

  const player = currentPlayer(state);
  state.stage = player?.inJail ? 'resolve' : 'roll';
  if (player?.inJail) state.prompt = { kind: 'jail' };

  checkEnd(state);
}

function checkEnd(state: GameState) {
  const alive = activePlayers(state);
  const limit = state.settings.roundLimit;

  if (limit > 0 && state.round > limit) {
    state.stage = 'over';
    const best = Math.max(...state.players.map((p) => netWorth(state, p.id)));
    state.winnerIds = state.players.filter((p) => netWorth(state, p.id) === best).map((p) => p.id);
    say(state, 'Круги закончились — считаем капитал', '🏆');
    return;
  }

  if (alive.length <= 1) {
    state.stage = 'over';
    state.winnerIds = alive.map((p) => p.id);
    say(state, 'Остался последний непобеждённый', '🏆');
  }
}

/** Раздаёт имущество банкрота и выбывает игрока. */
function goBankrupt(state: GameState, player: Player, creditorId: string | null) {
  const tiles = ownedTiles(state, player.id);

  if (creditorId) {
    const creditor = playerById(state, creditorId);
    if (creditor) {
      creditor.money += player.money;
      for (const i of tiles) {
        state.properties[i].ownerId = creditorId;
        // Дома возвращаются банку, участок переходит как есть.
        state.properties[i].houses = 0;
      }
      creditor.jailCards += player.jailCards;
    }
  } else {
    for (const i of tiles) {
      state.properties[i] = { ownerId: null, houses: 0, mortgaged: false };
    }
  }

  player.money = 0;
  player.jailCards = 0;
  player.bankrupt = true;
  player.inJail = false;
  say(state, `${player.name} объявляет банкротство`, '💥');
}

/* ─────────────────────────── строительство ─────────────────────────── */

export function canBuild(state: GameState, playerId: string, tileIndex: number): string | null {
  const tile = tileAt(tileIndex);
  const prop = state.properties[tileIndex];
  if (!prop || tile.kind !== 'street' || !tile.group) return 'Здесь нельзя строить';
  if (prop.ownerId !== playerId) return 'Участок не ваш';
  if (prop.mortgaged) return 'Участок заложен';
  if (!ownsGroup(state, playerId, tile.group)) return 'Нужна вся цветная группа';

  const group = groupTiles(tile.group);
  if (group.some((i) => state.properties[i].mortgaged)) return 'В группе есть заложенный участок';

  const cap = maxHouses(state);
  if (prop.houses >= cap) return prop.houses >= 6 ? 'Уже небоскрёб' : 'Уже отель';

  if (state.settings.evenBuild) {
    const min = Math.min(...group.map((i) => state.properties[i].houses));
    if (prop.houses > min) return 'Стройте равномерно по всей группе';
  }

  const { houses, hotels } = builtCounts(state);
  if (prop.houses < 4 && state.settings.houseSupply > 0 && houses >= state.settings.houseSupply) {
    return 'В банке закончились дома';
  }
  if (prop.houses === 4 && state.settings.hotelSupply > 0 && hotels >= state.settings.hotelSupply) {
    return 'В банке закончились отели';
  }

  const player = playerById(state, playerId);
  if (!player || player.money < buildCost(state, tileIndex)) return 'Не хватает денег';
  return null;
}

export function canMortgage(state: GameState, playerId: string, tileIndex: number): string | null {
  if (!state.settings.mortgages) return 'В этом режиме залог отключён';
  const prop = state.properties[tileIndex];
  const tile = tileAt(tileIndex);
  if (!prop || prop.ownerId !== playerId) return 'Участок не ваш';
  if (prop.mortgaged) return 'Уже заложен';
  if (prop.houses > 0) return 'Сначала продайте постройки';
  if (tile.group && groupTiles(tile.group).some((i) => state.properties[i].houses > 0)) {
    return 'В группе есть постройки';
  }
  return null;
}

/* ─────────────────────────── торги ─────────────────────────── */

function startAuction(state: GameState, tileIndex: number) {
  const bidders = activePlayers(state).map((p) => p.id);
  if (bidders.length === 0) {
    finishSegment(state, false);
    return;
  }
  state.stage = 'auction';
  state.prompt = { kind: 'none' };
  state.auction = {
    tile: tileIndex,
    bid: 0,
    leaderId: null,
    activeIds: bidders,
    turnId: bidders[0],
  };
  say(state, `${tileAt(tileIndex).name} уходит с торгов`, '🔨');
}

function auctionNext(state: GameState) {
  const a = state.auction;
  if (!a) return;

  if (a.activeIds.length <= 1) {
    const winnerId = a.leaderId ?? a.activeIds[0] ?? null;
    if (winnerId && a.bid > 0) {
      const winner = playerById(state, winnerId);
      if (winner && winner.money >= a.bid) {
        winner.money -= a.bid;
        state.properties[a.tile].ownerId = winnerId;
        winner.stats.bought += 1;
        say(state, `${winner.name} выкупает ${tileAt(a.tile).name} за ${money(a.bid)}`, '🔨');
      }
    } else {
      say(state, `${tileAt(a.tile).name} остаётся у банка`, '🏦');
    }
    state.auction = null;
    finishSegment(state, false);
    return;
  }

  const idx = a.activeIds.indexOf(a.turnId);
  a.turnId = a.activeIds[(idx + 1) % a.activeIds.length];
}

/* ─────────────────────────── главный редьюсер ─────────────────────────── */

export function applyAction(prev: GameState, playerId: string, action: Action): ActionResult {
  const state = clone(prev);
  const player = playerById(state, playerId);
  if (!player) return { state: prev, error: 'Игрок не найден' };
  if (state.stage === 'over') return { state: prev, error: 'Партия окончена' };

  const isCurrent = currentPlayer(state)?.id === playerId;

  /* Торги идут вне очереди хода. */
  if (state.stage === 'auction' && state.auction) {
    const a = state.auction;
    if (action.t === 'bid') {
      if (a.turnId !== playerId) return { state: prev, error: 'Сейчас не ваша ставка' };
      if (action.amount <= a.bid) return { state: prev, error: 'Ставка должна быть выше' };
      if (action.amount > player.money) return { state: prev, error: 'Не хватает денег' };
      a.bid = action.amount;
      a.leaderId = playerId;
      say(state, `${player.name} ставит ${money(action.amount)}`, '🔨');
      auctionNext(state);
      return { state };
    }
    if (action.t === 'pass') {
      if (a.turnId !== playerId) return { state: prev, error: 'Сейчас не ваш ход в торгах' };
      a.activeIds = a.activeIds.filter((id) => id !== playerId);
      say(state, `${player.name} выходит из торгов`, '🙅');
      if (a.activeIds.length > 0 && !a.activeIds.includes(a.turnId)) {
        a.turnId = a.activeIds[0];
      }
      auctionNext(state);
      return { state };
    }
    return { state: prev, error: 'Сейчас идут торги' };
  }

  /* Сделки можно предлагать и принимать в любой момент. */
  if (action.t === 'trade') {
    const offer: TradeOffer = { ...action.offer, id: `t${Date.now().toString(36)}` };
    if (offer.fromId !== playerId) return { state: prev, error: 'Чужое предложение' };
    state.trades.push(offer);
    player.tradedOnTurn = state.turn;
    const to = playerById(state, offer.toId);
    say(state, `${player.name} предлагает сделку игроку ${to?.name ?? '?'}`, '🤝');
    return { state };
  }

  if (action.t === 'tradeRespond') {
    const idx = state.trades.findIndex((t) => t.id === action.id);
    if (idx < 0) return { state: prev, error: 'Предложение не найдено' };
    const offer = state.trades[idx];
    if (offer.toId !== playerId) return { state: prev, error: 'Это предложение не вам' };
    state.trades.splice(idx, 1);

    if (!action.accept) {
      say(state, `${player.name} отклоняет сделку`, '🚫');
      return { state };
    }

    const from = playerById(state, offer.fromId);
    if (!from) return { state: prev, error: 'Автор сделки выбыл' };
    if (from.money < offer.giveMoney || player.money < offer.takeMoney) {
      return { state: prev, error: 'У кого-то не хватает денег' };
    }
    if (offer.giveTiles.some((i) => state.properties[i].ownerId !== from.id)) {
      return { state: prev, error: 'Участки уже сменили владельца' };
    }
    if (offer.takeTiles.some((i) => state.properties[i].ownerId !== player.id)) {
      return { state: prev, error: 'Участки уже сменили владельца' };
    }

    from.money -= offer.giveMoney;
    player.money += offer.giveMoney;
    player.money -= offer.takeMoney;
    from.money += offer.takeMoney;
    for (const i of offer.giveTiles) state.properties[i].ownerId = player.id;
    for (const i of offer.takeTiles) state.properties[i].ownerId = from.id;
    from.jailCards -= offer.giveJailCards;
    player.jailCards += offer.giveJailCards;
    player.jailCards -= offer.takeJailCards;
    from.jailCards += offer.takeJailCards;
    say(state, `${from.name} и ${player.name} совершили обмен`, '🤝');
    return { state };
  }

  /* Всё остальное — только в свой ход. */
  if (!isCurrent) return { state: prev, error: 'Сейчас не ваш ход' };

  switch (action.t) {
    /* ── тюрьма ── */
    case 'jailPay': {
      if (!player.inJail) return { state: prev, error: 'Вы не в тюрьме' };
      if (!pay(state, player.id, null, JAIL_FEE)) return { state };
      player.inJail = false;
      player.jailTurns = 0;
      say(state, `${player.name} вносит залог ${money(JAIL_FEE)}`, '🔓');
      state.stage = 'roll';
      state.prompt = { kind: 'none' };
      return { state };
    }

    case 'jailCard': {
      if (!player.inJail) return { state: prev, error: 'Вы не в тюрьме' };
      if (player.jailCards <= 0) return { state: prev, error: 'Нет карточки освобождения' };
      player.jailCards -= 1;
      player.inJail = false;
      player.jailTurns = 0;
      say(state, `${player.name} выходит по карточке`, '🔑');
      state.stage = 'roll';
      state.prompt = { kind: 'none' };
      return { state };
    }

    case 'jailRoll': {
      if (!player.inJail) return { state: prev, error: 'Вы не в тюрьме' };
      const d: [number, number] = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      state.dice = d;
      player.stats.rolls += 1;
      if (d[0] === d[1]) {
        player.inJail = false;
        player.jailTurns = 0;
        say(state, `${player.name} выбрасывает дубль и выходит на свободу`, '🎲');
        movePlayer(state, player, d[0] + d[1], false);
        return { state };
      }
      player.jailTurns += 1;
      if (player.jailTurns >= 3) {
        say(state, `${player.name} отсидел три хода и платит залог`, '🔓');
        if (!pay(state, player.id, null, JAIL_FEE)) return { state };
        player.inJail = false;
        player.jailTurns = 0;
        movePlayer(state, player, d[0] + d[1], false);
        return { state };
      }
      say(state, `${player.name} остаётся в тюрьме (${player.jailTurns} из 3)`, '🔒');
      nextTurn(state);
      return { state };
    }

    /* ── бросок и движение ── */
    case 'roll': {
      if (state.stage !== 'roll') return { state: prev, error: 'Сейчас нельзя бросать' };
      if (player.inJail) return { state: prev, error: 'Вы в тюрьме' };

      const d: [number, number] = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      state.dice = d;
      state.rolled = true;
      player.stats.rolls += 1;

      if (d[0] === d[1]) {
        state.doublesInRow += 1;
        player.stats.doubles += 1;
        if (state.doublesInRow >= 3) {
          say(state, `${player.name} выбрасывает третий дубль подряд`, '🚔');
          sendToJail(state, player);
          nextTurn(state);
          return { state };
        }
      } else {
        state.doublesInRow = 0;
      }

      movePlayer(state, player, d[0] + d[1], true);
      return { state };
    }

    /* ── разрешение клетки ── */
    case 'buy': {
      if (state.prompt.kind !== 'buy') return { state: prev, error: 'Нечего покупать' };
      const { tile, price } = state.prompt;
      if (player.money < price) return { state: prev, error: 'Не хватает денег' };
      player.money -= price;
      player.stats.bought += 1;
      state.properties[tile].ownerId = player.id;
      say(state, `${player.name} покупает ${tileAt(tile).name} за ${money(price)}`, '🏷️');
      finishSegment(state, false);
      return { state };
    }

    case 'decline': {
      if (state.prompt.kind !== 'buy') return { state: prev, error: 'Нечего отклонять' };
      const { tile } = state.prompt;
      if (state.settings.auctions) {
        state.prompt = { kind: 'none' };
        startAuction(state, tile);
      } else {
        say(state, `${player.name} отказывается от покупки`, '🙅');
        finishSegment(state, false);
      }
      return { state };
    }

    case 'ack': {
      const prompt = state.prompt;
      if (prompt.kind === 'rent') {
        const owner = playerById(state, prompt.toId);
        if (!pay(state, player.id, prompt.toId, prompt.amount)) return { state };
        player.stats.rentPaid += prompt.amount;
        say(state, `${player.name} платит ${money(prompt.amount)} игроку ${owner?.name ?? '?'}`, '💸');
        finishSegment(state, false);
        return { state };
      }
      if (prompt.kind === 'tax') {
        if (!pay(state, player.id, null, prompt.amount)) return { state };
        say(state, `${player.name} платит ${prompt.label}: ${money(prompt.amount)}`, '🧾');
        finishSegment(state, false);
        return { state };
      }
      if (prompt.kind === 'card') {
        const card = getCard(prompt.cardId);
        if (card) applyCard(state, player, card);
        else finishSegment(state, false);
        return { state };
      }
      return { state: prev, error: 'Нечего подтверждать' };
    }

    /* ── стройка и залог ── */
    case 'build': {
      const err = canBuild(state, playerId, action.tile);
      if (err) return { state: prev, error: err };
      const cost = buildCost(state, action.tile);
      player.money -= cost;
      state.properties[action.tile].houses += 1;
      const level = state.properties[action.tile].houses;
      const what = level >= 6 ? 'небоскрёб' : level === 5 ? 'отель' : `${level}-й дом`;
      say(state, `${player.name} строит ${what} на ${tileAt(action.tile).name}`, '🏗️');
      return { state };
    }

    case 'sellHouse': {
      const prop = state.properties[action.tile];
      if (!prop || prop.ownerId !== playerId) return { state: prev, error: 'Участок не ваш' };
      if (prop.houses <= 0) return { state: prev, error: 'Строений нет' };
      const tile = tileAt(action.tile);
      if (state.settings.evenBuild && tile.group) {
        const group = groupTiles(tile.group);
        const max = Math.max(...group.map((i) => state.properties[i].houses));
        if (prop.houses < max) return { state: prev, error: 'Сносите равномерно' };
      }
      const refund = Math.round(buildCostForLevel(state, action.tile, prop.houses) / 2);
      prop.houses -= 1;
      player.money += refund;
      say(state, `${player.name} продаёт постройку на ${tile.name} за ${money(refund)}`, '🏚️');
      settleDebtIfPossible(state, player);
      return { state };
    }

    case 'mortgage': {
      const err = canMortgage(state, playerId, action.tile);
      if (err) return { state: prev, error: err };
      const price = tileAt(action.tile).price ?? 0;
      const amount = Math.round(price / 2);
      state.properties[action.tile].mortgaged = true;
      player.money += amount;
      say(state, `${player.name} закладывает ${tileAt(action.tile).name} за ${money(amount)}`, '🏦');
      settleDebtIfPossible(state, player);
      return { state };
    }

    case 'unmortgage': {
      const prop = state.properties[action.tile];
      if (!prop || prop.ownerId !== playerId) return { state: prev, error: 'Участок не ваш' };
      if (!prop.mortgaged) return { state: prev, error: 'Участок не заложен' };
      const price = tileAt(action.tile).price ?? 0;
      const cost = Math.round((price / 2) * 1.1);
      if (player.money < cost) return { state: prev, error: 'Не хватает денег' };
      player.money -= cost;
      prop.mortgaged = false;
      say(state, `${player.name} выкупает ${tileAt(action.tile).name} за ${money(cost)}`, '🏦');
      return { state };
    }

    /* ── кредиты режима «Магнат» ── */
    case 'loan': {
      if (!state.settings.tycoon) return { state: prev, error: 'Кредиты доступны только в «Магнате»' };
      const limit = Math.max(0, Math.round(netWorth(state, playerId) / 2) - player.loan);
      if (action.amount <= 0 || action.amount > limit) return { state: prev, error: 'Банк столько не даст' };
      player.money += action.amount;
      player.loan += Math.round(action.amount * 1.2);
      say(state, `${player.name} берёт кредит ${money(action.amount)}`, '🏦');
      settleDebtIfPossible(state, player);
      return { state };
    }

    case 'repay': {
      const amount = Math.min(action.amount, player.loan, player.money);
      if (amount <= 0) return { state: prev, error: 'Нечего погашать' };
      player.money -= amount;
      player.loan -= amount;
      say(state, `${player.name} гасит кредит на ${money(amount)}`, '💳');
      return { state };
    }

    /* ── банкротство и завершение ── */
    case 'bankrupt': {
      const creditor = state.prompt.kind === 'debt' ? state.prompt.toId : null;
      goBankrupt(state, player, creditor);
      nextTurn(state);
      return { state };
    }

    case 'endTurn': {
      if (state.stage !== 'end') return { state: prev, error: 'Ход ещё не завершён' };
      if (player.loan > 0 && player.money >= player.loan) {
        // Кредит гасится автоматически, если денег хватает с запасом.
        const auto = Math.min(player.loan, Math.floor(player.money / 2));
        if (auto > 0) {
          player.money -= auto;
          player.loan -= auto;
        }
      }
      nextTurn(state);
      return { state };
    }
  }

  return { state: prev, error: 'Неизвестное действие' };
}

/** Стоимость постройки уровня level (для возврата половины при продаже). */
function buildCostForLevel(state: GameState, tileIndex: number, level: number): number {
  const base = tileAt(tileIndex).houseCost ?? 0;
  return level >= 6 ? base * SKYSCRAPER_COST_FACTOR : base;
}

/** Если игрок нашёл деньги, долг закрывается автоматически. */
function settleDebtIfPossible(state: GameState, player: Player) {
  if (state.stage !== 'debt' || state.prompt.kind !== 'debt') return;
  const { amount, toId } = state.prompt;
  if (player.money < amount) return;

  player.money -= amount;
  if (toId) {
    const to = playerById(state, toId);
    if (to) {
      to.money += amount;
      to.stats.rentEarned += amount;
    }
  } else if (state.settings.parkingPot) {
    state.pot += amount;
  }
  player.stats.rentPaid += toId ? amount : 0;
  say(state, `${player.name} рассчитался: ${money(amount)}`, '✅');
  finishSegment(state, false);
}

function movePlayer(state: GameState, player: Player, steps: number, allowPassGo: boolean) {
  const next = player.pos + steps;
  if (allowPassGo && next >= BOARD_SIZE) passGo(state, player);
  player.pos = next % BOARD_SIZE;
  state.stage = 'move';
  landOn(state, player);
}

/* ─────────────────────────── итоги ─────────────────────────── */

export function ranking(state: GameState): Player[] {
  return [...state.players].sort((a, b) => {
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    return netWorth(state, b.id) - netWorth(state, a.id);
  });
}

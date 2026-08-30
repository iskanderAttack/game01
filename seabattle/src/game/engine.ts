import { ABILITIES, ENERGY_PER_HIT, ENERGY_PER_SUNK, ENERGY_START, getAbility } from './abilities';
import {
  autoPlace,
  cellsLeft,
  emptyBoard,
  fleetDestroyed,
  halo,
  isSunk,
  shipAt,
  shipCells,
  shipsLeft,
  sunkViews,
} from './board';
import { cellName, inBoard, makeRng } from './coords';
import { getFleet } from './fleet';
import { getMode } from './modes';
import {
  HIT,
  MISS,
  NONE,
  emptyIntel,
  type Board,
  type BoardView,
  type Coord,
  type GameSettings,
  type GameState,
  type Intel,
  type Player,
  type ShotOutcome,
  type ShotRecord,
} from './types';

/* ───────────────────────────── копирование ───────────────────────────── */

function cloneBoard(b: Board): Board {
  return {
    size: b.size,
    ships: b.ships.map((s) => ({ ...s, hits: [...s.hits] })),
    shots: b.shots.map((row) => [...row]),
    mines: b.mines.map((m) => ({ ...m })),
  };
}

function cloneIntel(map: Record<string, Intel>): Record<string, Intel> {
  const out: Record<string, Intel> = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = { radar: [...v.radar], revealed: [...v.revealed], lines: [...v.lines] };
  }
  return out;
}

function clonePlayer(p: Player): Player {
  return { ...p, board: cloneBoard(p.board), stats: { ...p.stats }, intel: cloneIntel(p.intel) };
}

export function cloneState(s: GameState): GameState {
  return {
    ...s,
    settings: { ...s.settings },
    players: s.players.map(clonePlayer),
    log: [...s.log],
    winnerIds: [...s.winnerIds],
  };
}

/* ───────────────────────────── создание ───────────────────────────── */

export function makePlayer(init: Partial<Player> & { id: string; name: string }): Player {
  return {
    emoji: '⚓',
    color: '#38BDF8',
    isBot: false,
    alive: true,
    ready: false,
    energy: ENERGY_START,
    skipTurns: 0,
    smokeUntil: -1,
    board: emptyBoard(10),
    stats: { shots: 0, hits: 0, sunk: 0, abilities: 0 },
    intel: {},
    ...init,
  };
}

export function createGame(settings: GameSettings, roster: Player[], seed: number): GameState {
  const fleet = getFleet(settings.fleetId);
  const rng = makeRng(seed);

  const players = roster.map((p) => {
    const player = clonePlayer(p);
    player.board = emptyBoard(settings.boardSize);
    player.alive = true;
    player.ready = false;
    player.energy = ENERGY_START;
    player.skipTurns = 0;
    player.smokeUntil = -1;
    player.stats = { shots: 0, hits: 0, sunk: 0, abilities: 0 };
    player.intel = {};
    for (const other of roster) {
      if (other.id !== player.id) player.intel[other.id] = emptyIntel();
    }
    // Боты расставляются сами и сразу готовы.
    if (player.isBot) {
      const ships = autoPlace(
        settings.boardSize,
        fleet.sizes,
        settings.allowTouching,
        Math.floor(rng() * 2 ** 31),
      );
      if (ships) player.board.ships = ships;
      player.ready = true;
    }
    return player;
  });

  return {
    settings: { ...settings },
    players,
    phase: 'placement',
    turnIndex: 0,
    turn: 0,
    log: [],
    winnerIds: [],
    targetId: null,
    seed,
  };
}

export function everyoneReady(state: GameState): boolean {
  return state.players.every((p) => p.ready);
}

export function startBattle(state: GameState): GameState {
  const next = cloneState(state);
  next.phase = 'playing';
  next.turn = 1;
  next.turnIndex = 0;
  next.targetId = defaultTarget(next, next.players[0]?.id ?? '');
  return next;
}

/* ───────────────────────────── очередь ходов ───────────────────────────── */

export function currentPlayer(state: GameState): Player | null {
  return state.players[state.turnIndex] ?? null;
}

export function alivePlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.alive);
}

/** Соперники, по которым текущий игрок может стрелять. */
export function opponentsOf(state: GameState, playerId: string): Player[] {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return [];
  return state.players.filter((p) => p.id !== playerId && p.alive && !isAlly(me, p));
}

export function isAlly(a: Player, b: Player): boolean {
  return a.team !== undefined && b.team !== undefined && a.team === b.team;
}

export function alliesOf(state: GameState, playerId: string): Player[] {
  const me = state.players.find((p) => p.id === playerId);
  if (!me || me.team === undefined) return [];
  return state.players.filter((p) => p.id !== playerId && isAlly(me, p));
}

function defaultTarget(state: GameState, playerId: string): string | null {
  return opponentsOf(state, playerId)[0]?.id ?? null;
}

/**
 * Передаёт ход дальше. Игроки с пропуском хода (подрыв на мине) его
 * теряют, а выбывшие пропускаются совсем.
 */
export function advanceTurn(state: GameState, keepTurn = false): GameState {
  const next = cloneState(state);
  if (next.phase !== 'playing') return next;

  if (keepTurn) {
    next.turn += 1;
    return next;
  }

  const total = next.players.length;
  for (let step = 1; step <= total * 2 + 1; step++) {
    const idx = (next.turnIndex + step) % total;
    const candidate = next.players[idx];
    if (!candidate.alive) continue;
    if (candidate.skipTurns > 0) {
      candidate.skipTurns -= 1;
      continue;
    }
    next.turnIndex = idx;
    next.turn += 1;
    next.targetId = defaultTarget(next, candidate.id);
    return next;
  }

  // Все живые пропускают ход — просто крутим счётчик дальше.
  next.turn += 1;
  return next;
}

/* ───────────────────────────── выстрел ───────────────────────────── */

export interface FireResult {
  state: GameState;
  records: ShotRecord[];
  /** Стрелок сохраняет ход. */
  extraTurn: boolean;
  /** Строки для журнала боя. */
  messages: string[];
}

export function canFireAt(state: GameState, targetId: string, x: number, y: number): boolean {
  const target = state.players.find((p) => p.id === targetId);
  if (!target || !target.alive) return false;
  if (!inBoard(target.board.size, x, y)) return false;
  return target.board.shots[y][x] === NONE;
}

/** Один выстрел внутри уже склонированного состояния. */
function resolveShot(
  next: GameState,
  shooter: Player,
  target: Player,
  x: number,
  y: number,
  via?: string,
): { record: ShotRecord; message: string; hit: boolean } {
  const board = target.board;
  const ship = shipAt(board, x, y);
  const mineIndex = board.mines.findIndex((m) => m.x === x && m.y === y);

  shooter.stats.shots += 1;
  let outcome: ShotOutcome;
  let message: string;
  let hit = false;

  if (ship) {
    const index = shipCells(ship).findIndex((c) => c.x === x && c.y === y);
    ship.hits[index] = true;
    board.shots[y][x] = HIT;
    shooter.stats.hits += 1;
    shooter.energy += ENERGY_PER_HIT;
    hit = true;

    if (isSunk(ship)) {
      outcome = 'sunk';
      shooter.stats.sunk += 1;
      shooter.energy += ENERGY_PER_SUNK;
      message = `${shooter.name} потопил ${ship.size}-палубный у ${target.name} — ${cellName(x, y)}`;
      // По классическим правилам вокруг убитого корабля пусто: открываем обводку.
      if (!next.settings.allowTouching) {
        for (const c of halo(board, ship)) {
          if (board.shots[c.y][c.x] === NONE) board.shots[c.y][c.x] = MISS;
        }
      }
    } else {
      outcome = 'hit';
      message = `${shooter.name} попал по ${target.name} — ${cellName(x, y)}`;
    }
  } else if (mineIndex >= 0) {
    board.mines.splice(mineIndex, 1);
    board.shots[y][x] = MISS;
    shooter.skipTurns += 1;
    outcome = 'mine';
    message = `${shooter.name} подорвался на мине ${target.name} — ${cellName(x, y)}`;
  } else {
    board.shots[y][x] = MISS;
    outcome = 'miss';
    message = `${shooter.name} промахнулся по ${target.name} — ${cellName(x, y)}`;
  }

  // Дымовая завеса прячет от стрелка результат, но не отменяет урон.
  const smoked = target.smokeUntil >= next.turn;
  const record: ShotRecord = {
    turn: next.turn,
    byId: shooter.id,
    targetId: target.id,
    x,
    y,
    outcome: smoked ? 'hidden' : outcome,
    via,
  };
  if (smoked) message = `${shooter.name} стрелял по ${target.name} вслепую — ${cellName(x, y)}`;

  return { record, message, hit: hit && !smoked };
}

export function fire(state: GameState, byId: string, targetId: string, x: number, y: number): FireResult | null {
  if (state.phase !== 'playing') return null;
  if (!canFireAt(state, targetId, x, y)) return null;

  const next = cloneState(state);
  const shooter = next.players.find((p) => p.id === byId);
  const target = next.players.find((p) => p.id === targetId);
  if (!shooter || !target) return null;

  const { record, message, hit } = resolveShot(next, shooter, target, x, y);
  next.log.push(record);

  const messages = [message];
  messages.push(...settleEliminations(next));

  const extraTurn = next.settings.extraTurnOnHit && hit && target.alive;
  return { state: finishTurnBookkeeping(next), records: [record], extraTurn, messages };
}

/** Отмечает выбывших и определяет победителей. */
function settleEliminations(next: GameState): string[] {
  const messages: string[] = [];
  for (const p of next.players) {
    if (p.alive && fleetDestroyed(p.board)) {
      p.alive = false;
      messages.push(`💀 Флот ${p.name} уничтожен`);
    }
  }

  const alive = next.players.filter((p) => p.alive);
  const mode = getMode(next.settings.modeId);

  if (mode.teams) {
    const teams = new Set(alive.map((p) => p.team));
    if (teams.size <= 1) {
      const team = [...teams][0];
      next.phase = 'finished';
      next.winnerIds = next.players.filter((p) => p.team === team).map((p) => p.id);
    }
  } else if (alive.length <= 1) {
    next.phase = 'finished';
    next.winnerIds = alive.map((p) => p.id);
  }

  return messages;
}

function finishTurnBookkeeping(next: GameState): GameState {
  // Если цель выбыла, переводим прицел на следующего живого.
  const shooter = next.players[next.turnIndex];
  if (shooter) {
    const target = next.players.find((p) => p.id === next.targetId);
    if (!target || !target.alive) next.targetId = defaultTarget(next, shooter.id);
  }
  return next;
}

/* ───────────────────────────── способности ───────────────────────────── */

export interface AbilityParams {
  targetId?: string;
  x?: number;
  y?: number;
  axis?: 'row' | 'col';
  index?: number;
}

export interface AbilityResult {
  state: GameState;
  messages: string[];
  extraTurn: boolean;
  error?: string;
}

function countShipCells(board: Board, cells: Coord[]): number {
  return cells.filter((c) => !!shipAt(board, c.x, c.y)).length;
}

export function useAbility(
  state: GameState,
  byId: string,
  abilityId: string,
  params: AbilityParams,
): AbilityResult {
  const ability = getAbility(abilityId);
  const fail = (error: string): AbilityResult => ({ state, messages: [], extraTurn: false, error });

  if (!ability) return fail('Неизвестная способность');
  if (state.phase !== 'playing') return fail('Партия не идёт');

  const next = cloneState(state);
  const me = next.players.find((p) => p.id === byId);
  if (!me) return fail('Игрок не найден');
  if (me.energy < ability.cost) return fail(`Нужно ${ability.cost} энергии`);

  const target = next.players.find((p) => p.id === params.targetId);
  const messages: string[] = [];
  let extraTurn = false;

  switch (ability.id) {
    case 'radar': {
      if (!target || params.x === undefined || params.y === undefined) return fail('Не выбрана клетка');
      const cells: Coord[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = params.x + dx;
          const ny = params.y + dy;
          if (inBoard(target.board.size, nx, ny)) cells.push({ x: nx, y: ny });
        }
      }
      const count = countShipCells(target.board, cells);
      me.intel[target.id].radar.push({ x: params.x, y: params.y, size: 3, count });
      messages.push(`📡 Радар вокруг ${cellName(params.x, params.y)} у ${target.name}: палуб ${count}`);
      break;
    }

    case 'recon': {
      if (!target || params.axis === undefined || params.index === undefined) return fail('Не выбрана линия');
      const size = target.board.size;
      const cells: Coord[] = [];
      for (let i = 0; i < size; i++) {
        cells.push(params.axis === 'row' ? { x: i, y: params.index } : { x: params.index, y: i });
      }
      const count = countShipCells(target.board, cells);
      me.intel[target.id].lines.push({ axis: params.axis, index: params.index, count });
      const label = params.axis === 'row' ? `ряд ${cellName(0, params.index)[0]}` : `столбец ${params.index + 1}`;
      messages.push(`✈️ Разведка: ${label} у ${target.name} — палуб ${count}`);
      break;
    }

    case 'salvo': {
      if (!target || params.x === undefined || params.y === undefined) return fail('Не выбрана клетка');
      let any = false;
      for (let i = 0; i < 3; i++) {
        const x = params.x + i;
        if (!inBoard(target.board.size, x, params.y)) break;
        if (target.board.shots[params.y][x] !== NONE) continue;
        const r = resolveShot(next, me, target, x, params.y, 'salvo');
        next.log.push(r.record);
        messages.push(r.message);
        any = true;
      }
      if (!any) return fail('По этим клеткам уже стреляли');
      break;
    }

    case 'torpedo': {
      if (!target || params.axis === undefined || params.index === undefined) return fail('Не выбрана линия');
      const size = target.board.size;
      let struck = false;
      for (let i = 0; i < size; i++) {
        const x = params.axis === 'row' ? i : params.index;
        const y = params.axis === 'row' ? params.index : i;
        if (target.board.shots[y][x] !== NONE) continue;
        if (!shipAt(target.board, x, y)) continue;
        const r = resolveShot(next, me, target, x, y, 'torpedo');
        next.log.push(r.record);
        messages.push(`🚀 ${r.message}`);
        struck = true;
        break;
      }
      if (!struck) messages.push('🚀 Торпеда прошла линию впустую — кораблей нет');
      break;
    }

    case 'satellite': {
      if (!target) return fail('Не выбран соперник');
      const options: Coord[] = [];
      for (const ship of target.board.ships) {
        if (isSunk(ship)) continue;
        for (const c of shipCells(ship)) {
          if (target.board.shots[c.y][c.x] === NONE) options.push(c);
        }
      }
      if (options.length === 0) return fail('Целых кораблей не осталось');
      const rng = makeRng(next.seed + next.turn * 7919);
      const pick = options[Math.floor(rng() * options.length)];
      me.intel[target.id].revealed.push(pick);
      messages.push(`🛰️ Спутник: у ${target.name} корабль в ${cellName(pick.x, pick.y)}`);
      break;
    }

    case 'repair': {
      if (params.x === undefined || params.y === undefined) return fail('Не выбрана клетка');
      const ship = shipAt(me.board, params.x, params.y);
      if (!ship) return fail('Здесь нет корабля');
      if (isSunk(ship)) return fail('Потопленный корабль не восстановить');
      const index = shipCells(ship).findIndex((c) => c.x === params.x && c.y === params.y);
      if (!ship.hits[index]) return fail('Эта палуба цела');
      ship.hits[index] = false;
      me.board.shots[params.y][params.x] = NONE;
      messages.push(`🛠️ ${me.name} залатал пробоину в ${cellName(params.x, params.y)}`);
      break;
    }

    case 'smoke': {
      me.smokeUntil = next.turn + next.players.length;
      messages.push(`🌫️ ${me.name} скрылся в дыму`);
      break;
    }

    case 'mine': {
      if (params.x === undefined || params.y === undefined) return fail('Не выбрана клетка');
      if (shipAt(me.board, params.x, params.y)) return fail('Здесь стоит корабль');
      if (me.board.shots[params.y][params.x] !== NONE) return fail('По этой клетке уже стреляли');
      if (me.board.mines.some((m) => m.x === params.x && m.y === params.y)) return fail('Мина уже стоит');
      me.board.mines.push({ x: params.x, y: params.y });
      messages.push(`⚓ ${me.name} выставил мину`);
      break;
    }

    default:
      return fail('Способность недоступна');
  }

  me.energy -= ability.cost;
  me.stats.abilities += 1;
  messages.push(...settleEliminations(next));

  return { state: finishTurnBookkeeping(next), messages, extraTurn };
}

/** Список способностей, доступных игроку прямо сейчас. */
export function affordableAbilities(player: Player) {
  return ABILITIES.filter((a) => player.energy >= a.cost);
}

/* ───────────────────────── персональный вид ───────────────────────── */

export interface EnemyView {
  id: string;
  name: string;
  emoji: string;
  color: string;
  alive: boolean;
  team?: number;
  isBot: boolean;
  connected?: boolean;
  board: BoardView;
}

export interface ClientView {
  settings: GameSettings;
  phase: GameState['phase'];
  turn: number;
  turnOfId: string | null;
  targetId: string | null;
  me: Player;
  allies: Player[];
  enemies: EnemyView[];
  log: ShotRecord[];
  winnerIds: string[];
  seed: number;
}

function boardView(board: Board, intel: Intel): BoardView {
  return {
    size: board.size,
    shots: board.shots.map((row) => [...row]),
    sunk: sunkViews(board),
    shipsLeft: shipsLeft(board),
    cellsLeft: cellsLeft(board),
    intel: { radar: [...intel.radar], revealed: [...intel.revealed], lines: [...intel.lines] },
  };
}

/**
 * То, что можно безопасно отправить одному игроку.
 *
 * Своё поле уходит целиком, союзники — тоже, а вот чужие карты
 * превращаются в набор известных фактов. Иначе расположение кораблей
 * утекало бы в сетевой трафик, и партию можно было бы вскрыть.
 */
export function viewFor(state: GameState, playerId: string): ClientView | null {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return null;

  const allies = alliesOf(state, playerId).map(clonePlayer);
  const enemies: EnemyView[] = state.players
    .filter((p) => p.id !== playerId && !isAlly(me, p))
    .map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      color: p.color,
      alive: p.alive,
      team: p.team,
      isBot: p.isBot,
      connected: p.connected,
      board: boardView(p.board, me.intel[p.id] ?? emptyIntel()),
    }));

  return {
    settings: { ...state.settings },
    phase: state.phase,
    turn: state.turn,
    turnOfId: state.players[state.turnIndex]?.id ?? null,
    targetId: state.targetId,
    me: clonePlayer(me),
    allies,
    enemies,
    log: [...state.log],
    winnerIds: [...state.winnerIds],
    seed: state.seed,
  };
}

/* ───────────────────────────── прочее ───────────────────────────── */

export function accuracy(p: Player): number {
  return p.stats.shots === 0 ? 0 : p.stats.hits / p.stats.shots;
}

export function ranking(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    if (b.stats.sunk !== a.stats.sunk) return b.stats.sunk - a.stats.sunk;
    return accuracy(b) - accuracy(a);
  });
}

/** Подсказка «горячо — холодно» после промаха, для семейного режима. */
export function proximityHint(board: Board, x: number, y: number): string | null {
  let best = Infinity;
  for (const ship of board.ships) {
    if (isSunk(ship)) continue;
    for (const c of shipCells(ship)) {
      if (board.shots[c.y][c.x] !== NONE) continue;
      best = Math.min(best, Math.max(Math.abs(c.x - x), Math.abs(c.y - y)));
    }
  }
  if (best === Infinity) return null;
  if (best <= 1) return '🔥 Совсем рядом!';
  if (best === 2) return '🌡️ Тепло';
  if (best <= 4) return '❄️ Холодно';
  return '🧊 Ледяная пустыня';
}

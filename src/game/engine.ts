import { commonsScore, pairScore } from './payoffs';
import { getMode } from './modes';
import { rollEvent, getEvent } from './events';
import { getStrategy, type BotContext } from './strategies';
import type {
  GameSettings,
  GameState,
  Move,
  Pairing,
  Player,
  PlayerStats,
  RoundResult,
} from './types';

/* ────────────────────────────── случайность ───────────────────────────── */

/** Детерминированный ГПСЧ — одинаковый seed даёт одинаковую партию у всех по сети. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/* ─────────────────────────────── создание ─────────────────────────────── */

export function emptyStats(): PlayerStats {
  return {
    cooperations: 0,
    betrayals: 0,
    betrayed: 0,
    mutualCoop: 0,
    mutualDefect: 0,
    bestRound: 0,
    longestCoopStreak: 0,
    longestDefectStreak: 0,
  };
}

export function makePlayer(init: Partial<Player> & Pick<Player, 'id' | 'name'>): Player {
  return {
    emoji: '🙂',
    color: '#7C5CFF',
    isBot: false,
    score: 0,
    history: [],
    scoreLog: [],
    stats: emptyStats(),
    achievements: [],
    connected: true,
    ...init,
  };
}

/** Реальная длина партии: при «неизвестном финале» она скрыта от игроков. */
function resolveLength(settings: GameSettings, rng: () => number): number {
  if (settings.endingRule === 'fixed') return settings.rounds;
  const min = Math.max(3, Math.round(settings.rounds * 0.6));
  const cap = Math.max(min + 1, Math.round(settings.rounds * 1.8));
  let len = min;
  while (len < cap && rng() > settings.endChance) len++;
  return len;
}

export function createGame(settings: GameSettings, players: Player[], seed = randomSeed()): GameState {
  const rng = createRng(seed);
  const totalRounds = resolveLength(settings, rng);
  const fresh = players.map((p) => ({
    ...p,
    score: 0,
    history: [],
    scoreLog: [],
    stats: emptyStats(),
    achievements: [],
  }));
  const state: GameState = {
    settings,
    players: fresh,
    round: 0,
    totalRounds,
    phase: 'briefing',
    results: [],
    pending: {},
    turnIndex: 0,
    pairings: [],
    seed,
  };
  state.pairings = buildPairings(state);
  state.activeEvent = settings.events ? rollEvent(createRng(seed + 1)) : undefined;
  return state;
}

/* ─────────────────────────────── разбиение ────────────────────────────── */

/**
 * Круговой метод: фиксируем первого игрока, остальных вращаем.
 * Даёт «каждый раунд новый напарник» и корректно обрабатывает нечётное число.
 */
export function buildPairings(state: GameState): Pairing[] {
  const mode = getMode(state.settings.modeId);
  if (mode.structure !== 'pairs') return [];
  const ids = state.players.map((p) => p.id);
  if (ids.length < 2) return [];
  const list = ids.slice();
  if (list.length % 2 === 1) list.push('__bye__');
  const n = list.length;
  const rotating = list.slice(1);
  const shift = state.round % (n - 1);
  const rotated = [...rotating.slice(shift), ...rotating.slice(0, shift)];
  const arranged = [list[0], ...rotated];
  const pairs: Pairing[] = [];
  for (let i = 0; i < n / 2; i++) {
    const a = arranged[i];
    const b = arranged[n - 1 - i];
    if (a === '__bye__' || b === '__bye__') continue;
    pairs.push({ a, b });
  }
  return pairs;
}

export function partnerOf(state: GameState, playerId: string): string | undefined {
  for (const p of state.pairings) {
    if (p.a === playerId) return p.b;
    if (p.b === playerId) return p.a;
  }
  return undefined;
}

/* ──────────────────────────────── боты ────────────────────────────────── */

function coopRatio(state: GameState, roundIndex: number, exclude?: string): number {
  const res = state.results[roundIndex];
  if (!res) return 1;
  const ids = Object.keys(res.moves).filter((id) => id !== exclude);
  if (!ids.length) return 1;
  return ids.filter((id) => res.moves[id] === 'C').length / ids.length;
}

/** История «поля» глазами конкретного игрока: большинство как один соперник. */
function fieldHistoryFor(state: GameState, playerId: string): Move[] {
  return state.results.map((_, i) => (coopRatio(state, i, playerId) >= 0.5 ? 'C' : 'D'));
}

export function botMove(state: GameState, bot: Player): Move {
  const mode = getMode(state.settings.modeId);
  const strategy = getStrategy(bot.strategyId ?? 'mirror');
  let oppHistory: Move[];
  if (mode.structure === 'pairs') {
    const oppId = partnerOf(state, bot.id);
    const opp = state.players.find((p) => p.id === oppId);
    oppHistory = opp ? opp.history : fieldHistoryFor(state, bot.id);
  } else {
    oppHistory = fieldHistoryFor(state, bot.id);
  }
  const ctx: BotContext = {
    round: state.round,
    totalRounds: state.totalRounds,
    selfHistory: bot.history,
    oppHistory,
    lastCoopRatio: state.results.length ? coopRatio(state, state.results.length - 1, bot.id) : 1,
    fieldHistory: state.results.map((_, i) => coopRatio(state, i, bot.id)),
    rng: createRng(state.seed + state.round * 977 + hash(bot.id)),
  };
  return strategy.decide(ctx);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Дозаполняет ходы всех ботов, которые ещё не сходили. */
export function fillBotMoves(state: GameState): Record<string, Move> {
  const pending = { ...state.pending };
  for (const p of state.players) {
    if (p.isBot && !pending[p.id]) pending[p.id] = botMove(state, p);
  }
  return pending;
}

/* ─────────────────────────────── подсчёт ──────────────────────────────── */

const round1 = (n: number) => Math.round(n * 10) / 10;

export function resolveRound(state: GameState, intentsRaw: Record<string, Move>): RoundResult {
  const { settings } = state;
  const mode = getMode(settings.modeId);
  const event = state.activeEvent ? getEvent(state.activeEvent.id) : undefined;
  const rng = createRng(state.seed + state.round * 7919 + 13);

  const intents: Record<string, Move> = {};
  for (const p of state.players) intents[p.id] = intentsRaw[p.id] ?? 'C';

  // Туман недопонимания: ход может исказиться в противоположный.
  const noise = Math.min(0.9, settings.noise + (event?.extraNoise ?? 0));
  const moves: Record<string, Move> = {};
  const distorted: string[] = [];
  for (const p of state.players) {
    if (noise > 0 && rng() < noise) {
      moves[p.id] = intents[p.id] === 'C' ? 'D' : 'C';
      distorted.push(p.id);
    } else {
      moves[p.id] = intents[p.id];
    }
  }

  const deltas: Record<string, number> = {};
  for (const p of state.players) deltas[p.id] = 0;
  const log: string[] = [];
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? '—';
  const cooperators = state.players.filter((p) => moves[p.id] === 'C').length;

  if (mode.structure === 'pairs') {
    for (const { a, b } of state.pairings) {
      const ma = moves[a];
      const mb = moves[b];
      const sa = pairScore(ma, mb, settings.payoff);
      const sb = pairScore(mb, ma, settings.payoff);
      deltas[a] += sa;
      deltas[b] += sb;
      if (ma === 'C' && mb === 'C') log.push(`🤝 ${nameOf(a)} и ${nameOf(b)} промолчали: +${sa} обоим`);
      else if (ma === 'D' && mb === 'D') log.push(`💥 ${nameOf(a)} и ${nameOf(b)} сдали друг друга: ${sa} / ${sb}`);
      else if (ma === 'D') log.push(`🔪 ${nameOf(a)} сдал(а) ${nameOf(b)}: +${sa} против ${sb}`);
      else log.push(`🔪 ${nameOf(b)} сдал(а) ${nameOf(a)}: +${sb} против ${sa}`);
    }
    const paired = new Set(state.pairings.flatMap((p) => [p.a, p.b]));
    for (const p of state.players) {
      if (!paired.has(p.id)) {
        deltas[p.id] += settings.payoff.R;
        log.push(`💤 ${p.name} пропускает раунд: +${settings.payoff.R} утешительных`);
      }
    }
  } else if (mode.structure === 'roundRobin') {
    for (const p of state.players) {
      let sum = 0;
      for (const o of state.players) {
        if (o.id === p.id) continue;
        sum += pairScore(moves[p.id], moves[o.id], settings.payoff);
      }
      deltas[p.id] += sum;
    }
    log.push(`📊 Сотрудничали ${cooperators} из ${state.players.length}`);
  } else {
    const total = state.players.length;
    const stake = settings.payoff.R;
    const pot = round1(cooperators * stake * settings.commonsMultiplier);
    for (const p of state.players) {
      deltas[p.id] += commonsScore(moves[p.id], cooperators, total, settings.payoff, settings.commonsMultiplier);
    }
    log.push(`🪙 В котле ${pot} очков, доля каждого — ${round1(pot / total)}`);
    if (cooperators === total) log.push('🌟 Вложились все — максимальная общая выгода!');
    if (cooperators === 0) log.push('🕳️ Котёл пуст. Все остались при своих.');
  }

  // Эффекты события.
  if (event) {
    for (const p of state.players) {
      if (event.scoreMultiplier) deltas[p.id] *= event.scoreMultiplier;
      if (event.coopBonus && moves[p.id] === 'C') deltas[p.id] += event.coopBonus;
      if (event.defectPenalty && moves[p.id] === 'D') deltas[p.id] -= event.defectPenalty;
    }
  }
  for (const id of Object.keys(deltas)) deltas[id] = round1(deltas[id]);

  for (const id of distorted) log.push(`🌫️ Ход игрока ${nameOf(id)} исказился по дороге`);

  return {
    round: state.round,
    intents,
    moves,
    distorted,
    pairings: state.pairings,
    deltas,
    cooperators,
    event: state.activeEvent,
    log,
  };
}

/* ─────────────────────────── применение раунда ────────────────────────── */

function streak(history: Move[], target: Move): number {
  let best = 0;
  let cur = 0;
  for (const m of history) {
    if (m === target) {
      cur++;
      best = Math.max(best, cur);
    } else cur = 0;
  }
  return best;
}

export function applyRound(state: GameState, result: RoundResult): GameState {
  const mode = getMode(state.settings.modeId);
  const players = state.players.map((p) => {
    const move = result.moves[p.id];
    const history = [...p.history, move];
    const delta = result.deltas[p.id] ?? 0;
    const stats = { ...p.stats };
    if (move === 'C') stats.cooperations++;
    else stats.betrayals++;

    if (mode.structure === 'pairs') {
      const partner = result.pairings.find((x) => x.a === p.id || x.b === p.id);
      if (partner) {
        const oppId = partner.a === p.id ? partner.b : partner.a;
        const oppMove = result.moves[oppId];
        if (oppMove === 'D') stats.betrayed++;
        if (move === 'C' && oppMove === 'C') stats.mutualCoop++;
        if (move === 'D' && oppMove === 'D') stats.mutualDefect++;
      }
    } else {
      const others = state.players.filter((o) => o.id !== p.id);
      const defectors = others.filter((o) => result.moves[o.id] === 'D').length;
      if (defectors > others.length / 2) stats.betrayed++;
      if (move === 'C' && defectors === 0) stats.mutualCoop++;
      if (move === 'D' && defectors === others.length) stats.mutualDefect++;
    }

    stats.bestRound = Math.max(stats.bestRound, delta);
    stats.longestCoopStreak = streak(history, 'C');
    stats.longestDefectStreak = streak(history, 'D');

    return {
      ...p,
      history,
      score: round1(p.score + delta),
      scoreLog: [...p.scoreLog, delta],
      stats,
    };
  });

  const results = [...state.results, result];
  const nextRound = state.round + 1;
  const finished = nextRound >= state.totalRounds;

  const next: GameState = {
    ...state,
    players,
    results,
    round: nextRound,
    pending: {},
    turnIndex: 0,
    phase: finished ? 'finished' : 'scoreboard',
  };
  if (!finished) {
    next.pairings = buildPairings(next);
    next.activeEvent = state.settings.events
      ? rollEvent(createRng(state.seed + nextRound * 31 + 1))
      : undefined;
  }
  return next;
}

/* ──────────────────────────────── итоги ───────────────────────────────── */

export function ranking(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.score - a.score);
}

export function coopRate(p: Player): number {
  const total = p.history.length;
  return total ? p.stats.cooperations / total : 0;
}

/** На какую классическую стратегию похож живой игрок. */
export function classify(p: Player, state: GameState): { id: string; confidence: number } {
  const rate = coopRate(p);
  if (p.history.length === 0) return { id: 'mirror', confidence: 0 };
  if (rate >= 0.95) return { id: 'angel', confidence: rate };
  if (rate <= 0.05) return { id: 'devil', confidence: 1 - rate };

  // Сравниваем реальные ходы с тем, что сделала бы каждая стратегия.
  const virtual = { ...p, isBot: true } as Player;
  let best = { id: 'coin', confidence: 0 };
  for (const sid of ['mirror', 'patient', 'grudger', 'pavlov', 'grudger', 'kind', 'shark', 'conformist']) {
    let hits = 0;
    const replay: GameState = { ...state, results: [], round: 0, players: state.players };
    for (let r = 0; r < p.history.length; r++) {
      replay.results = state.results.slice(0, r);
      replay.round = r;
      replay.pairings = state.results[r]?.pairings ?? state.pairings;
      const predicted = botMove(replay, { ...virtual, strategyId: sid, history: p.history.slice(0, r) });
      if (predicted === p.history[r]) hits++;
    }
    const confidence = hits / p.history.length;
    if (confidence > best.confidence) best = { id: sid, confidence };
  }
  return best;
}

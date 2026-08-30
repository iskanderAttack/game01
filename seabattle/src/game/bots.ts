import { getAbility } from './abilities';
import { shipCells, sunkViews } from './board';
import { key, makeRng, neighbours } from './coords';
import { getFleet } from './fleet';
import { opponentsOf } from './engine';
import { HIT, MISS, NONE, type Board, type Coord, type GameState, type Player } from './types';

export interface BotAction {
  kind: 'fire' | 'ability';
  targetId: string;
  x?: number;
  y?: number;
  abilityId?: string;
  axis?: 'row' | 'col';
  index?: number;
}

/* ───────────────── публичная картина чужого поля ───────────────── */

interface PublicView {
  size: number;
  shots: number[][];
  /** Клетки потопленных кораблей — про них всё известно. */
  sunkCells: Set<string>;
  /** Попадания, которые ещё не сложились в потопленный корабль. */
  liveHits: Coord[];
  /** Размеры кораблей, которые ещё на плаву. */
  remaining: number[];
}

/**
 * Бот обязан рассуждать только о том, что видно любому сопернику:
 * сетка выстрелов, объявленные потопления и состав флота. Заглядывать
 * в расстановку соперника он не должен даже технически.
 */
function publicView(board: Board, fleetSizes: number[]): PublicView {
  const sunk = sunkViews(board);
  const sunkCells = new Set<string>();
  for (const s of sunk) {
    for (let i = 0; i < s.size; i++) {
      const x = s.dir === 'h' ? s.x + i : s.x;
      const y = s.dir === 'v' ? s.y + i : s.y;
      sunkCells.add(key(x, y));
    }
  }

  const liveHits: Coord[] = [];
  for (let y = 0; y < board.size; y++) {
    for (let x = 0; x < board.size; x++) {
      if (board.shots[y][x] === HIT && !sunkCells.has(key(x, y))) liveHits.push({ x, y });
    }
  }

  const remaining = [...fleetSizes];
  for (const s of sunk) {
    const i = remaining.indexOf(s.size);
    if (i >= 0) remaining.splice(i, 1);
  }

  return { size: board.size, shots: board.shots, sunkCells, liveHits, remaining };
}

const isOpen = (v: PublicView, x: number, y: number) =>
  x >= 0 && y >= 0 && x < v.size && y < v.size && v.shots[y][x] === NONE;

/* ───────────────────────────── охота ───────────────────────────── */

/** Клетки-кандидаты рядом с недобитыми попаданиями. */
function targetCandidates(v: PublicView): { cell: Coord; weight: number }[] {
  const out: { cell: Coord; weight: number }[] = [];
  const seen = new Set<string>();

  for (const hit of v.liveHits) {
    // Если рядом есть второе попадание — корабль лежит вдоль этой оси.
    const horizontal =
      (v.shots[hit.y]?.[hit.x - 1] === HIT && !v.sunkCells.has(key(hit.x - 1, hit.y))) ||
      (v.shots[hit.y]?.[hit.x + 1] === HIT && !v.sunkCells.has(key(hit.x + 1, hit.y)));
    const vertical =
      (v.shots[hit.y - 1]?.[hit.x] === HIT && !v.sunkCells.has(key(hit.x, hit.y - 1))) ||
      (v.shots[hit.y + 1]?.[hit.x] === HIT && !v.sunkCells.has(key(hit.x, hit.y + 1)));

    for (const n of neighbours(v.size, hit.x, hit.y)) {
      if (!isOpen(v, n.x, n.y)) continue;
      const k = key(n.x, n.y);
      const along = n.y === hit.y ? horizontal : vertical;
      const against = n.y === hit.y ? vertical : horizontal;
      // Продолжение линии ценнее, чем тычок поперёк неё.
      const weight = along ? 12 : against ? 1 : 5;
      if (seen.has(k)) {
        const found = out.find((o) => key(o.cell.x, o.cell.y) === k);
        if (found) found.weight = Math.max(found.weight, weight);
        continue;
      }
      seen.add(k);
      out.push({ cell: n, weight });
    }
  }

  return out;
}

/* ─────────────────────── карта вероятностей ─────────────────────── */

/**
 * Классический приём: для каждого оставшегося корабля перебираем все
 * позиции, куда он ещё может встать, и считаем, сколько раз накрывается
 * каждая клетка. Чем больше — тем вероятнее там корабль.
 */
function densityMap(v: PublicView): number[][] {
  const map = Array.from({ length: v.size }, () => Array<number>(v.size).fill(0));
  const sizes = [...new Set(v.remaining)];

  for (const size of sizes) {
    const copies = v.remaining.filter((s) => s === size).length;
    for (let y = 0; y < v.size; y++) {
      for (let x = 0; x < v.size; x++) {
        for (const dir of ['h', 'v'] as const) {
          const cells: Coord[] = [];
          let ok = true;
          for (let i = 0; i < size; i++) {
            const cx = dir === 'h' ? x + i : x;
            const cy = dir === 'v' ? y + i : y;
            if (cx >= v.size || cy >= v.size) {
              ok = false;
              break;
            }
            const mark = v.shots[cy][cx];
            // Корабль не может стоять на промахе или на потопленном соседе.
            if (mark === MISS || v.sunkCells.has(key(cx, cy))) {
              ok = false;
              break;
            }
            cells.push({ x: cx, y: cy });
          }
          if (!ok) continue;
          for (const c of cells) map[c.y][c.x] += copies;
        }
      }
    }
  }

  return map;
}

/* ───────────────────────────── выбор цели ───────────────────────────── */

function pickTarget(state: GameState, bot: Player, rng: () => number): Player | null {
  const foes = opponentsOf(state, bot.id);
  if (foes.length === 0) return null;
  if (foes.length === 1) return foes[0];

  const fleet = getFleet(state.settings.fleetId);

  // Сначала добиваем того, у кого уже есть незакрытые попадания.
  const wounded = foes.filter((f) => publicView(f.board, fleet.sizes).liveHits.length > 0);
  if (wounded.length > 0) {
    return wounded.sort((a, b) => a.board.size - b.board.size)[0];
  }

  if (bot.botLevel === 'easy') return foes[Math.floor(rng() * foes.length)];

  // Иначе выбираем самого потрёпанного: его добить проще.
  return foes
    .map((f) => ({ f, left: publicView(f.board, fleet.sizes).remaining.length }))
    .sort((a, b) => a.left - b.left)[0].f;
}

/* ───────────────────────────── ход бота ───────────────────────────── */

export function botAction(state: GameState, botId: string): BotAction | null {
  const bot = state.players.find((p) => p.id === botId);
  if (!bot) return null;

  const rng = makeRng(state.seed + state.turn * 104729 + botId.length);
  const target = pickTarget(state, bot, rng);
  if (!target) return null;

  const fleet = getFleet(state.settings.fleetId);
  const v = publicView(target.board, fleet.sizes);
  const level = bot.botLevel ?? 'normal';

  // В штабном режиме сильный бот тратит накопленное на разведку.
  if (state.settings.abilities && level === 'hard' && v.liveHits.length === 0) {
    const radar = getAbility('radar');
    if (radar && bot.energy >= radar.cost + 2) {
      const map = densityMap(v);
      const spot = bestCell(map, v, rng, 1);
      if (spot) {
        return { kind: 'ability', abilityId: 'radar', targetId: target.id, x: spot.x, y: spot.y };
      }
    }
  }

  // Есть подранок — добиваем.
  const candidates = targetCandidates(v);
  if (candidates.length > 0) {
    if (level === 'easy' && rng() < 0.35) {
      const any = randomOpenCell(v, rng);
      if (any) return { kind: 'fire', targetId: target.id, x: any.x, y: any.y };
    }
    const best = candidates.sort((a, b) => b.weight - a.weight || rng() - 0.5)[0];
    return { kind: 'fire', targetId: target.id, x: best.cell.x, y: best.cell.y };
  }

  if (level === 'easy') {
    const cell = randomOpenCell(v, rng);
    return cell ? { kind: 'fire', targetId: target.id, x: cell.x, y: cell.y } : null;
  }

  if (level === 'normal') {
    // Шахматный поиск: корабль минимум из двух клеток не пропустишь.
    const step = Math.max(2, Math.min(...v.remaining, 2));
    const parity = openCells(v).filter((c) => (c.x + c.y) % step === 0);
    const pool = parity.length > 0 ? parity : openCells(v);
    const cell = pool[Math.floor(rng() * pool.length)];
    return cell ? { kind: 'fire', targetId: target.id, x: cell.x, y: cell.y } : null;
  }

  const map = densityMap(v);
  const cell = bestCell(map, v, rng, Math.max(2, Math.min(...v.remaining, 2)));
  return cell ? { kind: 'fire', targetId: target.id, x: cell.x, y: cell.y } : null;
}

function openCells(v: PublicView): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < v.size; y++) {
    for (let x = 0; x < v.size; x++) if (v.shots[y][x] === NONE) out.push({ x, y });
  }
  return out;
}

function randomOpenCell(v: PublicView, rng: () => number): Coord | null {
  const cells = openCells(v);
  return cells.length ? cells[Math.floor(rng() * cells.length)] : null;
}

function bestCell(map: number[][], v: PublicView, rng: () => number, parityStep: number): Coord | null {
  let best: Coord | null = null;
  let bestScore = -1;

  for (let y = 0; y < v.size; y++) {
    for (let x = 0; x < v.size; x++) {
      if (v.shots[y][x] !== NONE) continue;
      // Небольшая надбавка за «шахматные» клетки и капля случайности,
      // чтобы бот не ходил одинаково из партии в партию.
      const parityBonus = (x + y) % parityStep === 0 ? 1.35 : 1;
      const score = map[y][x] * parityBonus + rng() * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }

  return best;
}

export const BOT_LEVELS = [
  {
    id: 'easy' as const,
    name: 'Юнга',
    emoji: '🧢',
    description: 'Стреляет почти наугад и иногда теряет подранка. Хороший спарринг для детей.',
  },
  {
    id: 'normal' as const,
    name: 'Боцман',
    emoji: '🎣',
    description: 'Ищет шахматным порядком, найдя корабль — уверенно добивает вдоль линии.',
  },
  {
    id: 'hard' as const,
    name: 'Адмирал',
    emoji: '🎖️',
    description:
      'Строит карту вероятностей по всем возможным расстановкам оставшегося флота. Играет сильнее большинства людей.',
  },
];

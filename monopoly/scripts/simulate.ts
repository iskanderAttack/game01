/**
 * Прогон партий без интерфейса.
 *
 * Проверяет то, что глазами не увидишь: что партия вообще заканчивается,
 * что ставка не убегает за границы, что не появляются отрицательные деньги
 * и портфели, что боты пользуются рынком, а стартапы и умирают, и выходят
 * на биржу.
 *
 *   npx tsx scripts/simulate.ts [режим] [игроков] [партий]
 */
import { applyAction, createGame, makePlayer, netWorth, type Action } from '../src/game/engine';
import { botAction, botFinance, botTradeReply } from '../src/game/bots';
import { getMode } from '../src/game/modes';
import { DEFAULT_SETTINGS } from './defaults';
import { portfolioValue } from '../src/game/market';
import type { GameState } from '../src/game/types';

const MAX_ACTIONS = 60000;

interface Tally {
  rounds: number;
  actions: number;
  finOps: number;
  startupsFounded: number;
  ipos: number;
  deaths: number;
  maxRate: number;
  minRate: number;
  winner: string;
  errors: string[];
  finished: boolean;
}

function botToAct(game: GameState): string | null {
  if (game.stage === 'auction' && game.auction) {
    const bidder = game.players.find((p) => p.id === game.auction!.turnId);
    return bidder?.isBot ? bidder.id : null;
  }
  for (const offer of game.trades) {
    const to = game.players.find((p) => p.id === offer.toId);
    if (to?.isBot && !to.bankrupt) return to.id;
  }
  const current = game.players[game.turnIndex];
  return current?.isBot && !current.bankrupt ? current.id : null;
}

function run(modeId: string, players: number, level: 'easy' | 'normal' | 'hard'): Tally {
  const mode = getMode(modeId);
  const settings = { ...DEFAULT_SETTINGS, modeId, ...mode.defaults, botLevel: level };
  const roster = Array.from({ length: players }, (_, i) =>
    makePlayer({ id: `p${i}`, name: `Бот ${i + 1}`, isBot: true, botLevel: level }),
  );

  let game = createGame(settings, roster);
  const tally: Tally = {
    rounds: 0,
    actions: 0,
    finOps: 0,
    startupsFounded: 0,
    ipos: 0,
    deaths: 0,
    maxRate: game.market?.keyRate ?? 0,
    minRate: game.market?.keyRate ?? 99,
    winner: '',
    errors: [],
    finished: false,
  };

  const step = (playerId: string, action: Action) => {
    const result = applyAction(game, playerId, action);
    if (result.error) {
      // Отказ движка — нормальная часть игры, но копим их для отчёта.
      tally.errors.push(`${action.t}: ${result.error}`);
      return false;
    }
    game = result.state;
    tally.actions += 1;
    if (action.t === 'fin') tally.finOps += 1;
    if (action.t === 'fin' && action.op.op === 'found') tally.startupsFounded += 1;
    return true;
  };

  while (game.stage !== 'over' && tally.actions < MAX_ACTIONS) {
    const id = botToAct(game);
    if (!id) {
      tally.errors.push('никто не может ходить');
      break;
    }

    const reply = botTradeReply(game, id);
    if (reply && step(id, reply)) continue;

    const finance = botFinance(game, id);
    if (finance && step(id, finance)) continue;

    const action = botAction(game, id);
    if (!action) {
      if (game.stage === 'end') step(id, { t: 'endTurn' });
      else {
        tally.errors.push(`бот не придумал хода на стадии ${game.stage}`);
        break;
      }
      continue;
    }
    if (!step(id, action)) {
      // Чтобы не зациклиться на отвергнутом действии — завершаем ход.
      if (game.stage === 'end') step(id, { t: 'endTurn' });
      else break;
    }

    if (game.market) {
      tally.maxRate = Math.max(tally.maxRate, game.market.keyRate);
      tally.minRate = Math.min(tally.minRate, game.market.keyRate);
    }
  }

  tally.rounds = game.round;
  tally.finished = game.stage === 'over';
  tally.winner = game.players.find((p) => game.winnerIds.includes(p.id))?.name ?? '—';

  /* Проверки целостности. */
  for (const p of game.players) {
    if (p.money < 0) tally.errors.push(`${p.name}: отрицательные деньги ${p.money}`);
    if (game.market) {
      const value = portfolioValue(game.market, p.portfolio);
      if (value < 0) tally.errors.push(`${p.name}: отрицательный портфель ${value}`);
      if (!Number.isFinite(value)) tally.errors.push(`${p.name}: портфель не число`);
      if (!Number.isFinite(netWorth(game, p.id))) tally.errors.push(`${p.name}: капитал не число`);
      tally.ipos += p.portfolio.startups.filter((s) => s.state === 'public').length;
      tally.deaths += p.portfolio.startups.filter((s) => s.state === 'dead').length;
    }
  }
  if (game.market) {
    if (game.market.keyRate < 4 || game.market.keyRate > 20) {
      tally.errors.push(`ставка вне диапазона: ${game.market.keyRate}`);
    }
    for (const [id, price] of Object.entries(game.market.prices)) {
      if (!Number.isFinite(price) || price < 0) tally.errors.push(`цена ${id} = ${price}`);
    }
  }

  return tally;
}

const modeId = process.argv[2] ?? 'empire';
const players = Number(process.argv[3] ?? 4);
const games = Number(process.argv[4] ?? 10);

let failed = 0;
for (let i = 0; i < games; i++) {
  const level = (['easy', 'normal', 'hard'] as const)[i % 3];
  const t = run(modeId, players, level);
  const bad = t.errors.filter((e) => !e.includes('Не хватает') && !e.includes('Сейчас не'));
  if (bad.length || !t.finished) failed += 1;
  console.log(
    `${modeId}/${players}/${level}: круги ${t.rounds}, действий ${t.actions}, ` +
      (t.finOps
        ? `операций с деньгами ${t.finOps}, стартапов ${t.startupsFounded} ` +
          `(IPO ${t.ipos}, закрылось ${t.deaths}), ставка ${t.minRate}–${t.maxRate}, `
        : '') +
      `${t.finished ? 'завершена' : 'НЕ ЗАВЕРШЕНА'}, победил ${t.winner}` +
      (bad.length ? `\n   ⚠ ${[...new Set(bad)].slice(0, 5).join(' | ')}` : ''),
  );
}
console.log(failed === 0 ? '\n✅ все партии чистые' : `\n❌ проблемных партий: ${failed}`);

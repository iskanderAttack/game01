import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../store/appStore';
import { classify, coopRate, ranking } from '../../game/engine';
import { getAchievement } from '../../game/achievements';
import { getStrategy } from '../../game/strategies';
import { getMode } from '../../game/modes';
import { Screen, TopBar, SectionTitle } from '../components/Shell';
import { Avatar, HistoryStrip } from '../components/PlayerBits';
import { StatTile } from '../components/controls';
import { Confetti } from '../components/Confetti';
import { play, tap } from '../../lib/feedback';
import { disconnect } from '../../net/client';
import type { GameState, Player } from '../../game/types';

export function ResultsScreen() {
  const game = useApp((s) => s.game);
  const restart = useApp((s) => s.restart);
  const quitGame = useApp((s) => s.quitGame);
  const go = useApp((s) => s.go);
  const localPlayerId = useApp((s) => s.localPlayerId);
  const netRole = useApp((s) => s.netRole);

  useEffect(() => {
    play('win');
  }, []);

  const table = useMemo(() => (game ? ranking(game.players) : []), [game]);
  if (!game) return null;

  const mode = getMode(game.settings.modeId);
  const champion = table[0];
  const totalCoop = game.results.reduce((s, r) => s + r.cooperators, 0);
  const totalMoves = game.results.length * game.players.length;
  const teamRate = totalMoves ? totalCoop / totalMoves : 0;
  const perfectRounds = game.results.filter((r) => r.cooperators === game.players.length).length;
  const bestPossible = 'Идеальный мир';

  return (
    <Screen name="results" className="results">
      <Confetti />
      <TopBar title="Итоги партии" subtitle={`${mode.emoji} ${mode.name} · ${game.results.length} раундов`} />

      <div className="scroll">
        <Podium table={table} />

        <div className="card verdict">
          <div className="verdict-emoji">{teamRate > 0.7 ? '🕊️' : teamRate > 0.4 ? '⚖️' : '🔥'}</div>
          <div>
            <div className="verdict-title">
              {teamRate > 0.7
                ? 'Общество доверия'
                : teamRate > 0.4
                  ? 'Хрупкое равновесие'
                  : 'Все против всех'}
            </div>
            <p className="muted" style={{ fontSize: 13.5 }}>
              {teamRate > 0.7
                ? 'Вы почти всегда выбирали сотрудничество — и вместе собрали куда больше очков, чем смогли бы поодиночке.'
                : teamRate > 0.4
                  ? 'Доверие возникало и рушилось. Классический сценарий: каждый пробовал урвать и получал сдачи.'
                  : 'Предательство стало нормой. Все остались с малым — ровно то, что предсказывает теория игр.'}
            </p>
          </div>
        </div>

        <div className="stats-grid">
          <StatTile label="Сотрудничество" value={`${Math.round(teamRate * 100)}%`} accent="var(--coop)" />
          <StatTile label={bestPossible} value={`${perfectRounds}×`} accent="var(--gold)" />
          <StatTile label="Очков всего" value={round(table.reduce((s, p) => s + p.score, 0))} />
        </div>

        <SectionTitle>Разбор игроков</SectionTitle>
        {table.map((p, i) => (
          <PlayerReport key={p.id} player={p} place={i + 1} game={game} me={p.id === localPlayerId} />
        ))}

        <SectionTitle>Как менялся счёт</SectionTitle>
        <ScoreChart game={game} />
      </div>

      {netRole === 'client' ? (
        <button
          className="btn primary block"
          onClick={() => {
            tap();
            disconnect();
            quitGame();
          }}
        >
          Выйти из комнаты
        </button>
      ) : (
        <div className="row" style={{ gap: 10 }}>
          <button
            className="btn grow"
            onClick={() => {
              tap();
              quitGame();
            }}
          >
            В меню
          </button>
          <button
            className="btn primary grow"
            onClick={() => {
              tap('select');
              restart();
            }}
          >
            Реванш 🔁
          </button>
        </div>
      )}
    </Screen>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;

function Podium({ table }: { table: Player[] }) {
  const [first, second, third] = table;
  const order = [second, first, third].filter(Boolean);
  const heights: Record<string, number> = { [first?.id ?? '']: 132 };
  if (second) heights[second.id] = 100;
  if (third) heights[third.id] = 84;

  return (
    <div className="podium">
      {order.map((p, idx) => {
        const place = p.id === first?.id ? 1 : p.id === second?.id ? 2 : 3;
        return (
          <motion.div
            key={p.id}
            className={`podium-col place-${place}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: heights[p.id], opacity: 1 }}
            transition={{ delay: 0.12 * idx, type: 'spring', stiffness: 180, damping: 20 }}
          >
            <div className="podium-top">
              <motion.div
                initial={{ scale: 0, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ delay: 0.25 + 0.12 * idx, type: 'spring', stiffness: 320, damping: 18 }}
              >
                <Avatar player={p} size={place === 1 ? 62 : 48} />
              </motion.div>
              <div className="podium-name">{p.name}</div>
              <div className="podium-score mono">{round(p.score)}</div>
            </div>
            <div className="podium-medal">{['🥇', '🥈', '🥉'][place - 1]}</div>
          </motion.div>
        );
      })}
    </div>
  );
}

function PlayerReport({
  player,
  place,
  game,
  me,
}: {
  player: Player;
  place: number;
  game: GameState;
  me?: boolean;
}) {
  const guess = classify(player, game);
  const strat = getStrategy(guess.id);
  const rate = coopRate(player);

  return (
    <motion.div
      className={`card report ${me ? 'me' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * place }}
    >
      <div className="row">
        <span className="place mono">{place}</span>
        <Avatar player={player} size={44} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="score-name">{player.name}</div>
          <HistoryStrip history={player.history} max={20} />
        </div>
        <div className="report-score mono">{round(player.score)}</div>
      </div>

      <div className="report-bar">
        <div className="bar-fill coop" style={{ width: `${rate * 100}%` }} />
        <span className="bar-label mono">
          🤝 {Math.round(rate * 100)}% · 🔪 {Math.round((1 - rate) * 100)}%
        </span>
      </div>

      {!player.isBot && guess.confidence > 0.5 && (
        <div className="report-guess">
          <span>{strat.emoji}</span>
          <span className="muted" style={{ fontSize: 13 }}>
            Вы играли похоже на <b style={{ color: 'var(--text)' }}>«{strat.name}»</b> — совпадение{' '}
            {Math.round(guess.confidence * 100)}%. {strat.short}.
          </span>
        </div>
      )}
      {player.isBot && (
        <div className="report-guess">
          <span>{strat.emoji}</span>
          <span className="muted" style={{ fontSize: 13 }}>
            Стратегия: <b style={{ color: 'var(--text)' }}>{getStrategy(player.strategyId ?? '').name}</b> —{' '}
            {getStrategy(player.strategyId ?? '').short}.
          </span>
        </div>
      )}

      {player.achievements.length > 0 && (
        <div className="wrap" style={{ marginTop: 10 }}>
          {player.achievements.map((id) => {
            const a = getAchievement(id);
            if (!a) return null;
            return (
              <motion.span
                key={id}
                className={`achievement ${a.rarity}`}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 18 }}
                title={a.description}
              >
                {a.emoji} {a.name}
              </motion.span>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function ScoreChart({ game }: { game: GameState }) {
  const rounds = game.results.length;
  if (rounds === 0) return null;
  const series = game.players.map((p) => {
    let acc = 0;
    return { player: p, points: p.scoreLog.map((d) => (acc += d)) };
  });
  const max = Math.max(1, ...series.flatMap((s) => s.points));
  const min = Math.min(0, ...series.flatMap((s) => s.points));
  const W = 320;
  const H = 140;
  const x = (i: number) => (rounds === 1 ? W / 2 : (i / (rounds - 1)) * W);
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * H;

  return (
    <div className="card chart-card">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="160" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} className="chart-grid" />
        ))}
        {series.map((s) => (
          <motion.polyline
            key={s.player.id}
            points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke={s.player.color}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
        ))}
      </svg>
      <div className="wrap" style={{ marginTop: 8 }}>
        {game.players.map((p) => (
          <span key={p.id} className="chip">
            <i className="legend-dot" style={{ background: p.color }} /> {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}

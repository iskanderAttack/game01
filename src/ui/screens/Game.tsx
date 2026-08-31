import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { currentTurnPlayer, useApp } from '../../store/appStore';
import { getMode, wording } from '../../game/modes';
import { ranking } from '../../game/engine';
import { Screen, TopBar, Sheet, Panel, NetStalledOverlay } from '../components/Shell';
import { ChoiceStage } from '../components/ChoiceStage';
import { RevealStage } from '../components/RevealStage';
import { PassDevice } from '../components/PassDevice';
import { ScoreRow, Avatar } from '../components/PlayerBits';
import { tap, play } from '../../lib/feedback';
import { submitMoveEverywhere } from '../../net/bridge';
import type { Move } from '../../game/types';

export function GameScreen() {
  const game = useApp((s) => s.game);
  const reveal = useApp((s) => s.reveal);
  const netRole = useApp((s) => s.netRole);
  const localPlayerId = useApp((s) => s.localPlayerId);
  const submitMove = useApp((s) => s.submitMove);
  const toScoreboard = useApp((s) => s.toScoreboard);
  const nextRound = useApp((s) => s.nextRound);
  const quitGame = useApp((s) => s.quitGame);
  const beginRound = useApp((s) => s.beginRound);

  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [waitHost, setWaitHost] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);

  const mode = game ? getMode(game.settings.modeId) : null;
  const turnPlayer = currentTurnPlayer(game, netRole, localPlayerId);

  const localHumans = useMemo(
    () => (game ? game.players.filter((p) => !p.isBot && !p.remote) : []),
    [game],
  );
  const needsGate = netRole === 'local' && localHumans.length > 1;

  // «Ширма» показывается каждому новому игроку, пока он не подтвердит, что это он.
  useEffect(() => {
    setReadyFor(null);
  }, [game?.phase, game?.round]);

  // Фазы двигает хост: клиент просто ждёт следующего снимка состояния.
  useEffect(() => setWaitHost(false), [game?.phase, game?.round]);

  // Состояние ещё не приехало от хоста — показываем ожидание, а не пустоту.
  if (!game || !mode) {
    return (
      <Screen name="game" className="game-screen">
        <div className="card center" style={{ padding: 30, marginTop: 40 }}>
          <div className="shimmer" style={{ fontSize: 36 }}>
            🃏
          </div>
          <div className="net-title" style={{ marginTop: 12 }}>
            Ждём партию
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            Хост ещё не прислал состояние игры.
          </p>
          <button
            className="btn block"
            style={{ marginTop: 18 }}
            onClick={() => {
              tap();
              quitGame();
            }}
          >
            На главный экран
          </button>
        </div>
      </Screen>
    );
  }

  const w = wording(game.settings.modeId);
  const waiting = game.players.filter((p) => !p.isBot && p.remote && !game.pending[p.id]);
  const roundLabel =
    game.settings.endingRule === 'unknown'
      ? `Раунд ${Math.min(game.round + 1, game.totalRounds)} · финал неизвестен`
      : `Раунд ${Math.min(game.round + 1, game.totalRounds)} из ${game.totalRounds}`;

  const handlePick = (move: Move) => {
    if (!turnPlayer) return;
    submitMoveEverywhere(turnPlayer.id, move);
  };

  return (
    <Screen name="game" className="game-screen">
      <TopBar
        title={`${mode.emoji} ${mode.name}`}
        subtitle={roundLabel}
        right={
          <button
            className="icon-btn"
            onClick={() => {
              tap();
              setMenuOpen(true);
            }}
            aria-label="Меню"
          >
            ⋯
          </button>
        }
      />

      <div className="round-progress">
        {Array.from({ length: game.totalRounds }).map((_, i) => (
          <span key={i} className={`tick ${i < game.round ? 'done' : ''} ${i === game.round ? 'now' : ''}`} />
        ))}
      </div>

      <div className="scroll">
        <AnimatePresence mode="wait">
          {game.phase === 'briefing' && (
            <Panel key="briefing" name="briefing" className="stack">
              <div className="card glow briefing" style={{ borderColor: `${mode.accent}55` }}>
                <div className="briefing-emoji">{mode.emoji}</div>
                <h3 className="briefing-title">{mode.name}</h3>
                <p className="muted">{mode.description}</p>
                <div className="wrap" style={{ marginTop: 14 }}>
                  <span className="chip">👥 {game.players.length} игроков</span>
                  <span className="chip">
                    🔁 {game.settings.endingRule === 'unknown' ? '≈' : ''}
                    {game.settings.rounds} раундов
                  </span>
                  {game.settings.noise > 0 && <span className="chip">🌫️ шум {Math.round(game.settings.noise * 100)}%</span>}
                  {game.settings.events && <span className="chip">🌀 события</span>}
                  {game.settings.timer > 0 && <span className="chip">⏱ {game.settings.timer} с</span>}
                </div>
              </div>

              <div className="card">
                <span className="label">Кто играет</span>
                <div className="wrap" style={{ marginTop: 10 }}>
                  {game.players.map((p) => (
                    <div key={p.id} className="mini-player">
                      <Avatar player={p} size={34} />
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {netRole === 'client' ? (
                <div className="waiting-hint">Хост вот-вот начнёт партию…</div>
              ) : (
                <button
                  className="btn primary block"
                  onClick={() => {
                    tap('select');
                    beginRound();
                  }}
                >
                  Начать партию
                </button>
              )}
            </Panel>
          )}

          {game.phase === 'collecting' && (
            <Panel key="collecting" name="collecting">
              {turnPlayer ? (
                <ChoiceStage
                  key={`${turnPlayer.id}-${game.round}`}
                  state={game}
                  player={turnPlayer}
                  onPick={handlePick}
                  waitingFor={netRole !== 'local' ? waiting : undefined}
                />
              ) : (
                <WaitingRoom names={waiting.map((p) => p.name)} />
              )}
            </Panel>
          )}

          {game.phase === 'reveal' && reveal && (
            <Panel key="reveal" name="reveal">
              <RevealStage
                state={game}
                result={reveal}
                spotlightId={netRole === 'local' ? null : localPlayerId}
                onDone={() => {
                  tap('select');
                  if (netRole === 'client') setWaitHost(true);
                  else toScoreboard();
                }}
              />
              {waitHost && <div className="waiting-hint">Ждём хоста…</div>}
            </Panel>
          )}

          {game.phase === 'scoreboard' && (
            <Panel key="scoreboard" name="scoreboard" className="stack">
              <div className="label">Положение после {game.round} раунда</div>
              <div className="card" style={{ padding: 8 }}>
                {ranking(game.players).map((p, i) => (
                  <ScoreRow
                    key={p.id}
                    player={p}
                    place={i + 1}
                    delta={game.results[game.results.length - 1]?.deltas[p.id]}
                    highlight={p.id === localPlayerId}
                  />
                ))}
              </div>
              {game.activeEvent && (
                <div className="card next-event">
                  <span className="event-emoji">{game.activeEvent.emoji}</span>
                  <div>
                    <div className="label">Следующий раунд</div>
                    <div className="event-name">{game.activeEvent.name}</div>
                    <div className="event-desc">{game.activeEvent.description}</div>
                  </div>
                </div>
              )}
              {netRole === 'client' ? (
                <div className="waiting-hint">Ждём, когда хост начнёт следующий раунд…</div>
              ) : (
                <button
                  className="btn primary block"
                  onClick={() => {
                    tap('select');
                    play('event');
                    nextRound();
                  }}
                >
                  Раунд {game.round + 1} →
                </button>
              )}
            </Panel>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {needsGate && game.phase === 'collecting' && turnPlayer && readyFor !== turnPlayer.id && (
          <PassDevice player={turnPlayer} onReady={() => setReadyFor(turnPlayer.id)} />
        )}
      </AnimatePresence>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Партия">
        <div className="stack">
          <div className="card">
            <span className="label">Матрица выплат</span>
            <div className="matrix" style={{ marginTop: 10 }}>
              <div />
              <div className="mh">{w.coop}</div>
              <div className="mh">{w.defect}</div>
              <div className="mh">{w.coop}</div>
              <div className="mc good">
                {game.settings.payoff.R} / {game.settings.payoff.R}
              </div>
              <div className="mc bad">
                {game.settings.payoff.S} / {game.settings.payoff.T}
              </div>
              <div className="mh">{w.defect}</div>
              <div className="mc bad">
                {game.settings.payoff.T} / {game.settings.payoff.S}
              </div>
              <div className="mc">
                {game.settings.payoff.P} / {game.settings.payoff.P}
              </div>
            </div>
          </div>
          <div className="card">
            <span className="label">История раундов</span>
            <div className="stack" style={{ marginTop: 10 }}>
              {game.results.length === 0 && <div className="muted">Ещё ничего не сыграно.</div>}
              {game.results
                .slice()
                .reverse()
                .slice(0, 8)
                .map((r) => (
                  <div key={r.round} className="round-log">
                    <b className="mono">R{r.round + 1}</b>
                    <span className="muted">
                      {r.cooperators}/{game.players.length} сотрудничали
                      {r.event ? ` · ${r.event.emoji} ${r.event.name}` : ''}
                    </span>
                  </div>
                ))}
            </div>
          </div>
          {!confirmQuit ? (
            <button className="btn block" onClick={() => setConfirmQuit(true)}>
              Выйти из партии
            </button>
          ) : (
            <div className="card" style={{ borderColor: 'var(--defect)' }}>
              <div className="muted" style={{ marginBottom: 12 }}>
                Прогресс партии будет потерян. Точно выходим?
              </div>
              <div className="row">
                <button className="btn grow" onClick={() => setConfirmQuit(false)}>
                  Остаться
                </button>
                <button
                  className="btn grow"
                  style={{ background: 'var(--defect-dim)', borderColor: 'var(--defect)' }}
                  onClick={() => {
                    setMenuOpen(false);
                    quitGame();
                  }}
                >
                  Выйти
                </button>
              </div>
            </div>
          )}
        </div>
      </Sheet>
      <NetStalledOverlay />

    </Screen>
  );
}

function WaitingRoom({ names }: { names: string[] }) {
  return (
    <div className="waiting-room center">
      <motion.div
        className="waiting-orb"
        animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        ⏳
      </motion.div>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginTop: 18 }}>Ход сделан</h3>
      <p className="muted" style={{ marginTop: 8 }}>
        {names.length ? `Ждём: ${names.join(', ')}` : 'Подсчитываем результаты…'}
      </p>
    </div>
  );
}

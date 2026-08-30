import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getEvent } from '../../game/events';
import { getMode, wording } from '../../game/modes';
import type { GameState, Move, Player, RoundResult } from '../../game/types';
import { Avatar } from './PlayerBits';
import { haptic, play } from '../../lib/feedback';

export function RevealStage({
  state,
  result,
  onDone,
  spotlightId,
}: {
  state: GameState;
  result: RoundResult;
  onDone: () => void;
  spotlightId?: string | null;
}) {
  const mode = getMode(state.settings.modeId);
  const speed = state.settings.revealSpeed;
  const hidden = state.settings.anonymous || !!getEvent(result.event?.id ?? '')?.blind;
  const [step, setStep] = useState(0);

  const order: string[] = hidden
    ? []
    : mode.structure === 'pairs'
      ? result.pairings.flatMap((p) => [p.a, p.b])
      : state.players.map((p) => p.id);

  useEffect(() => {
    play('reveal');
    if (hidden) {
      const t = setTimeout(() => setStep(order.length + 1), 500 * speed);
      return () => clearTimeout(t);
    }
    let i = 0;
    const id = setInterval(() => {
      i++;
      setStep(i);
      haptic('light');
      play('flip');
      if (i > order.length) clearInterval(id);
    }, 380 * speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.round]);

  const revealed = (id: string) => hidden || step > order.indexOf(id);
  const allShown = step > order.length || hidden;

  return (
    <div className="reveal-stage">
      {result.event && (
        <motion.div
          className="event-banner card"
          initial={{ opacity: 0, y: -14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        >
          <span className="event-emoji">{result.event.emoji}</span>
          <div>
            <div className="event-name">{result.event.name}</div>
            <div className="event-desc">{result.event.description}</div>
          </div>
        </motion.div>
      )}

      <div className="reveal-title">
        Раунд {result.round + 1} — вскрытие
      </div>

      {hidden ? (
        <motion.div className="blind-card card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="blind-emoji">🕶️</div>
          <div className="blind-count mono">
            {result.cooperators} / {state.players.length}
          </div>
          <div className="muted">
            {mode.structure === 'commons' ? 'вложились в общий котёл' : 'выбрали сотрудничество'}
          </div>
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            Кто именно — останется тайной.
          </div>
        </motion.div>
      ) : mode.structure === 'pairs' ? (
        <div className="pairs-grid">
          {result.pairings.map((pair, i) => {
            const a = state.players.find((p) => p.id === pair.a)!;
            const b = state.players.find((p) => p.id === pair.b)!;
            return (
              <div className="pair-row" key={`${pair.a}-${pair.b}-${i}`}>
                <RevealCard
                  player={a}
                  move={result.moves[a.id]}
                  delta={result.deltas[a.id]}
                  shown={revealed(a.id)}
                  distorted={result.distorted.includes(a.id)}
                  spotlight={spotlightId === a.id}
                />
                <div className="pair-vs">
                  {revealed(a.id) && revealed(b.id) ? verdictEmoji(result.moves[a.id], result.moves[b.id]) : '⋯'}
                </div>
                <RevealCard
                  player={b}
                  move={result.moves[b.id]}
                  delta={result.deltas[b.id]}
                  shown={revealed(b.id)}
                  distorted={result.distorted.includes(b.id)}
                  spotlight={spotlightId === b.id}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="reveal-grid">
          {state.players.map((p) => (
            <RevealCard
              key={p.id}
              player={p}
              move={result.moves[p.id]}
              delta={result.deltas[p.id]}
              shown={revealed(p.id)}
              distorted={result.distorted.includes(p.id)}
              spotlight={spotlightId === p.id}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {allShown && (
          <motion.div
            className="reveal-log"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            {result.log.slice(0, 6).map((line, i) => (
              <motion.div
                key={i}
                className="log-line"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.18 + i * 0.06 }}
              >
                {line}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        className="btn primary block"
        initial={{ opacity: 0 }}
        animate={{ opacity: allShown ? 1 : 0.3 }}
        disabled={!allShown}
        onClick={onDone}
      >
        Дальше →
      </motion.button>
    </div>
  );
}

function verdictEmoji(a: Move, b: Move): string {
  if (a === 'C' && b === 'C') return '🤝';
  if (a === 'D' && b === 'D') return '💥';
  return '🔪';
}

function RevealCard({
  player,
  move,
  delta,
  shown,
  distorted,
  spotlight,
}: {
  player: Player;
  move: Move;
  delta: number;
  shown: boolean;
  distorted: boolean;
  spotlight?: boolean;
}) {
  return (
    <div className={`reveal-card-wrap ${spotlight ? 'spotlight' : ''}`}>
      <motion.div
        className="reveal-card"
        animate={{ rotateY: shown ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 210, damping: 22 }}
      >
        <div className="face back">
          <span className="q">?</span>
        </div>
        <div className={`face front ${move === 'C' ? 'c' : 'd'}`}>
          <span className="reveal-move">{move === 'C' ? '🤝' : '🔪'}</span>
          <span className="reveal-delta mono">
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
          {distorted && <span className="distorted" title="ход исказился">🌫️</span>}
        </div>
      </motion.div>
      <div className="reveal-name">
        <Avatar player={player} size={26} ring={false} />
        <span>{player.name}</span>
      </div>
    </div>
  );
}

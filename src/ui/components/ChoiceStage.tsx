import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { contextualHints } from '../../game/hints';
import { getMode, wording } from '../../game/modes';
import { partnerOf } from '../../game/engine';
import { pairScore } from '../../game/payoffs';
import type { GameState, Move, Player } from '../../game/types';
import { Avatar, HistoryStrip } from './PlayerBits';
import { HintBubble } from './HintBubble';
import { haptic, play } from '../../lib/feedback';

export function ChoiceStage({
  state,
  player,
  onPick,
  waitingFor,
}: {
  state: GameState;
  player: Player;
  onPick: (move: Move) => void;
  waitingFor?: Player[];
}) {
  const mode = getMode(state.settings.modeId);
  const w = wording(state.settings.modeId);
  const hints = state.settings.hints ? contextualHints(state, player.id).slice(0, 4) : [];
  const [locked, setLocked] = useState(false);
  const [left, setLeft] = useState(state.settings.timer);
  const pickedRef = useRef(false);

  const partnerId = mode.structure === 'pairs' ? partnerOf(state, player.id) : undefined;
  const partner = state.players.find((p) => p.id === partnerId);

  const choose = (move: Move) => {
    if (pickedRef.current) return;
    pickedRef.current = true;
    setLocked(true);
    play(move === 'C' ? 'coop' : 'defect');
    haptic(move === 'C' ? 'success' : 'medium');
    setTimeout(() => onPick(move), 260);
  };

  useEffect(() => {
    if (!state.settings.timer) return;
    setLeft(state.settings.timer);
    const id = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(id);
          if (!pickedRef.current) choose('C');
          return 0;
        }
        if (v <= 4) play('tick');
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id, state.round]);

  const { R, S, T, P } = state.settings.payoff;

  return (
    <div className="choice-stage">
      <div className="choice-head">
        <Avatar player={player} size={54} />
        <div className="grow">
          <div className="choice-name">{player.name}</div>
          <HistoryStrip history={player.history} />
        </div>
        {state.settings.timer > 0 && (
          <div className={`timer-ring ${left <= 4 ? 'urgent' : ''} mono`}>
            <svg viewBox="0 0 44 44" width="44" height="44">
              <circle cx="22" cy="22" r="19" className="track" />
              <circle
                cx="22"
                cy="22"
                r="19"
                className="fill"
                style={{
                  strokeDasharray: 119.4,
                  strokeDashoffset: 119.4 * (1 - left / Math.max(1, state.settings.timer)),
                }}
              />
            </svg>
            <span>{left}</span>
          </div>
        )}
      </div>

      {partner && (
        <div className="opponent-card card">
          <span className="label">Напарник в этом раунде</span>
          <div className="row" style={{ marginTop: 10 }}>
            <Avatar player={partner} size={44} />
            <div className="grow">
              <div className="score-name">{partner.name}</div>
              <HistoryStrip history={partner.history} />
            </div>
            <div className="mono opponent-score">{partner.score}</div>
          </div>
        </div>
      )}

      {mode.structure === 'commons' && (
        <div className="opponent-card card">
          <span className="label">Общий котёл</span>
          <div className="commons-row">
            {state.players.map((p) => (
              <div key={p.id} className="commons-chip">
                <Avatar player={p} size={30} ring={false} />
                <span className="mono">{p.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="choice-title">{w.title}</div>

      <div className="choice-cards">
        <ChoiceCard
          kind="coop"
          title={w.coop}
          emoji={w.coopEmoji}
          hint={w.coopHint}
          best={mode.structure === 'commons' ? `+${R}·k` : `+${R}`}
          worst={mode.structure === 'commons' ? '' : `${S}`}
          disabled={locked}
          onPick={() => choose('C')}
        />
        <ChoiceCard
          kind="defect"
          title={w.defect}
          emoji={w.defectEmoji}
          hint={w.defectHint}
          best={mode.structure === 'commons' ? `+${R}` : `+${T}`}
          worst={mode.structure === 'commons' ? '' : `${P}`}
          disabled={locked}
          onPick={() => choose('D')}
        />
      </div>

      {mode.structure !== 'commons' && (
        <div className="payoff-legend mono">
          <span>
            🤝🤝 <b>{pairScore('C', 'C', state.settings.payoff)}</b>
          </span>
          <span>
            🤝🔪 <b>{S}</b> / <b>{T}</b>
          </span>
          <span>
            🔪🔪 <b>{P}</b>
          </span>
        </div>
      )}

      {hints.length > 0 && <HintBubble hints={hints} />}

      {waitingFor && waitingFor.length > 0 && (
        <div className="waiting-list">
          <span className="label">Ещё думают</span>
          <div className="wrap" style={{ marginTop: 8 }}>
            {waitingFor.map((p) => (
              <span key={p.id} className="chip">
                {p.emoji} {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChoiceCard({
  kind,
  title,
  emoji,
  hint,
  best,
  worst,
  disabled,
  onPick,
}: {
  kind: 'coop' | 'defect';
  title: string;
  emoji: string;
  hint: string;
  best: string;
  worst: string;
  disabled?: boolean;
  onPick: () => void;
}) {
  return (
    <motion.button
      className={`choice-card ${kind}`}
      whileTap={{ scale: 0.955 }}
      initial={{ opacity: 0, y: 26, rotateX: -8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: kind === 'coop' ? 0.04 : 0.1 }}
      disabled={disabled}
      onClick={onPick}
    >
      <span className="choice-emoji">{emoji}</span>
      <span className="choice-card-title">{title}</span>
      <span className="choice-card-hint">{hint}</span>
      <span className="choice-card-nums mono">
        <b>{best}</b>
        {worst !== '' && <i>{worst}</i>}
      </span>
      <span className="choice-shine" />
    </motion.button>
  );
}

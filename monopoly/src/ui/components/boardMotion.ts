import { useEffect, useState } from 'react';
import type { GameState, Player } from '../../game/types';

/**
 * Движение фишек по клеткам — общее для объёмной и плоской доски.
 *
 * Фишка не телепортируется: она идёт по клеткам, одну за другой. Куда и как
 * именно — берём из состояния (`lastMove`), поэтому на всех устройствах
 * движение выходит одинаковым.
 */

const STEP_MS = 92;

export function useWalk(state: GameState | null, animate: boolean): Record<string, number> {
  const [shown, setShown] = useState<Record<string, number>>(() => snapshot(state));

  // Новые игроки и переносы по дуге ставятся сразу.
  useEffect(() => {
    if (!state) return;
    setShown((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const p of state.players) {
        if (next[p.id] === undefined) {
          next[p.id] = p.pos;
          changed = true;
        }
      }
      const jump = state.lastMove;
      if (jump && jump.kind === 'jump' && next[jump.playerId] !== jump.to) {
        next[jump.playerId] = jump.to;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const walking = state.players.some(
      (p) => shown[p.id] !== undefined && shown[p.id] !== p.pos,
    );
    if (!walking) return;

    if (!animate) {
      setShown(snapshot(state));
      return;
    }

    const timer = setTimeout(() => {
      setShown((prev) => {
        const next = { ...prev };
        for (const p of state.players) {
          const cur = next[p.id];
          if (cur === undefined || cur === p.pos) continue;
          next[p.id] = (cur + 1) % 40;
        }
        return next;
      });
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [state, shown, animate]);

  return shown;
}

function snapshot(state: GameState | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of state?.players ?? []) out[p.id] = p.pos;
  return out;
}

/** Место фишки на клетке: у каждого игрока свой угол, чтобы не наезжали. */
export function slotOn(
  state: GameState,
  player: Player,
  shown: Record<string, number>,
): number {
  const here = state.players.filter(
    (p) => !p.bankrupt && (shown[p.id] ?? p.pos) === (shown[player.id] ?? player.pos),
  );
  return Math.max(0, here.findIndex((p) => p.id === player.id));
}

/** Сдвиг фазы покачивания: у каждого игрока своё дыхание. */
export function hashPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h % 10;
}

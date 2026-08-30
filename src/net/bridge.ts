import { useApp } from '../store/appStore';
import { sendMove } from './client';
import type { Move } from '../game/types';

/** Единая точка отправки хода: локально — в движок, по сети — хосту. */
export function submitMoveEverywhere(playerId: string, move: Move) {
  const app = useApp.getState();
  if (app.netRole === 'client') {
    sendMove(move);
    const g = app.game;
    if (g) useApp.setState({ game: { ...g, pending: { ...g.pending, [playerId]: move } } });
    return;
  }
  app.submitMove(playerId, move);
}

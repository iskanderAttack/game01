import { useApp } from '../store/appStore';
import { sendAction } from './client';
import type { Action } from '../game/engine';

/**
 * Единая точка действия: у хозяина партии ход считает движок,
 * у сетевого гостя — уходит хосту, который остаётся судьёй.
 */
export function act(playerId: string, action: Action) {
  const app = useApp.getState();
  if (app.netRole === 'client') {
    sendAction(action);
    return;
  }
  app.applyLocal(playerId, action);
}

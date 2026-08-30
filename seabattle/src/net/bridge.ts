import { useApp } from '../store/appStore';
import { sendAbility, sendFire, sendFleet, sendTarget } from './client';
import type { AbilityParams } from '../game/engine';
import type { Ship } from '../game/types';

/**
 * Единая точка действия: на своём устройстве ход считает движок,
 * по сети — уходит хосту, который остаётся единственным судьёй.
 */

export function fireEverywhere(x: number, y: number) {
  const app = useApp.getState();
  if (app.netRole === 'client') {
    const view = app.remoteView;
    if (!view?.targetId) return;
    sendFire(view.targetId, x, y);
    return;
  }
  app.shoot(x, y);
}

export function castEverywhere(abilityId: string, params: AbilityParams): string | null {
  const app = useApp.getState();
  if (app.netRole === 'client') {
    sendAbility(abilityId, params);
    return null;
  }
  return app.castAbility(abilityId, params);
}

export function selectTargetEverywhere(targetId: string) {
  const app = useApp.getState();
  if (app.netRole === 'client') {
    sendTarget(targetId);
    useApp.setState({ remoteView: app.remoteView ? { ...app.remoteView, targetId } : null });
    return;
  }
  app.selectTarget(targetId);
}

/** Клиент расставляет флот у себя и отправляет расстановку хосту. */
export function submitFleetEverywhere(playerId: string, ships: Ship[]) {
  const app = useApp.getState();
  if (app.netRole === 'client') {
    sendFleet(ships);
    if (app.remoteView) {
      useApp.setState({
        remoteView: { ...app.remoteView, me: { ...app.remoteView.me, ready: true } },
      });
    }
    return;
  }
  app.setReady(playerId);
}

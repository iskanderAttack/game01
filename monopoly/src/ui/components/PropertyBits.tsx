import { GROUP_COLORS, GROUP_NAMES, RAIL_RENT, groupTiles } from '../../game/board';
import { countOwned, ownsGroup, tileAt } from '../../game/engine';
import { money } from '../../game/money';
import { RAIL_TILES, UTILITY_TILES } from '../../game/board';
import type { GameState } from '../../game/types';

/** Карточка участка — как настоящая купчая из коробки. */
export function DeedCard({ state, tileIndex }: { state: GameState; tileIndex: number }) {
  const tile = tileAt(tileIndex);
  const prop = state.properties[tileIndex];
  const owner = prop?.ownerId ? state.players.find((p) => p.id === prop.ownerId) : null;
  const bandColor = tile.group ? GROUP_COLORS[tile.group] : '#3c4a5c';

  return (
    <div className="deed">
      <div className="deed-band" style={{ background: bandColor }}>
        {tile.name}
      </div>
      <div className="deed-body">
        {tile.group && (
          <div className="deed-row">
            <span>Группа</span>
            <b>{GROUP_NAMES[tile.group]}</b>
          </div>
        )}

        {tile.kind === 'street' && tile.rent && (
          <>
            <div className="deed-row">
              <span>Аренда без построек</span>
              <b>{money(tile.rent[0])}</b>
            </div>
            {[1, 2, 3, 4].map((n) => (
              <div className="deed-row" key={n}>
                <span>
                  {n} {n === 1 ? 'дом' : 'дома'}
                </span>
                <b>{money(tile.rent![n])}</b>
              </div>
            ))}
            <div className="deed-row">
              <span>Отель</span>
              <b>{money(tile.rent[5])}</b>
            </div>
            {state.settings.tycoon && (
              <div className="deed-row">
                <span>Небоскрёб</span>
                <b>{money(Math.round(tile.rent[5] * 1.75))}</b>
              </div>
            )}
            <div className="deed-row">
              <span>Дом / отель стоит</span>
              <b>{money(tile.houseCost ?? 0)}</b>
            </div>
          </>
        )}

        {tile.kind === 'rail' && (
          <>
            {[1, 2, 3, 4].map((n) => (
              <div className="deed-row" key={n}>
                <span>{n} вокзал{n > 1 ? 'а' : ''} у владельца</span>
                <b>{money(RAIL_RENT[n])}</b>
              </div>
            ))}
          </>
        )}

        {tile.kind === 'utility' && (
          <>
            <div className="deed-row">
              <span>Одна служба</span>
              <b>бросок × 4 тыс.</b>
            </div>
            <div className="deed-row">
              <span>Обе службы</span>
              <b>бросок × 10 тыс.</b>
            </div>
          </>
        )}

        {tile.price && (
          <div className="deed-row total">
            <span>Цена</span>
            <b>{money(tile.price)}</b>
          </div>
        )}

        {tile.price && state.settings.mortgages && (
          <div className="deed-row">
            <span>Залог</span>
            <b>{money(Math.round(tile.price / 2))}</b>
          </div>
        )}

        <div className="deed-note">
          {owner ? (
            <>
              Владелец: <b>{owner.emoji} {owner.name}</b>
              {prop?.mortgaged && ' · участок заложен'}
              {tile.group && ownsGroup(state, owner.id, tile.group) && ' · собрана вся группа, аренда удвоена'}
            </>
          ) : tile.price ? (
            'Участок свободен — его можно купить, попав на клетку.'
          ) : (
            'Эта клетка не продаётся.'
          )}
        </div>
      </div>
    </div>
  );
}

/** Сколько участков группы уже собрано — для подсказок в интерфейсе. */
export function groupProgress(state: GameState, tileIndex: number): string | null {
  const tile = tileAt(tileIndex);
  if (tile.kind === 'rail') {
    const ownerId = state.properties[tileIndex]?.ownerId;
    if (!ownerId) return null;
    return `${countOwned(state, ownerId, RAIL_TILES)} из 4 вокзалов`;
  }
  if (tile.kind === 'utility') {
    const ownerId = state.properties[tileIndex]?.ownerId;
    if (!ownerId) return null;
    return `${countOwned(state, ownerId, UTILITY_TILES)} из 2 служб`;
  }
  if (!tile.group) return null;
  const ownerId = state.properties[tileIndex]?.ownerId;
  if (!ownerId) return null;
  const group = groupTiles(tile.group);
  return `${countOwned(state, ownerId, group)} из ${group.length} в группе`;
}

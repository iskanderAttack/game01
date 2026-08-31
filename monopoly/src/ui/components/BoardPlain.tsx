import { memo, useCallback, useContext, useRef } from 'react';
import { BOARD, GROUP_COLORS } from '../../game/board';
import { MONTHS, seasonOf } from '../../game/market';
import type { GameState, Tile } from '../../game/types';
import { BOARD_PX, tileCenter, tileRect } from './boardGeometry';
import { slotOn, useWalk } from './boardMotion';
import { BoardToggle } from './BoardToggle';
import { SafeMotion } from './Shell';
import { Dice } from './Dice';

/**
 * Плоская доска.
 *
 * Это не «объёмная доска без наклона», а совсем другая отрисовка: ни
 * перспективы, ни камеры, ни трёхмерного контекста, ни слоёв под каждой
 * клеткой. Вся доска — сорок обычных прямоугольников в процентах от
 * квадратного контейнера, который целиком помещается на экране.
 *
 * Зачем: объёмная сцена держит в видеопамяти один слой размером с доску,
 * увеличенный масштабом камеры и плотностью экрана. На телефоне с плотным
 * экраном это десятки мегабайт, и система начинает выбрасывать куски слоя —
 * доска «пропадает частями». Здесь такого слоя нет вовсе.
 *
 * Что видно: цвет группы, чей участок, сколько домов и где стоят фишки.
 * Названия и цены не влезут в тридцать пикселей — они открываются касанием.
 */

export function BoardPlain({
  state,
  highlight,
  onTile,
}: {
  state: GameState;
  highlight?: number | null;
  onTile?: (index: number) => void;
}) {
  const safe = useContext(SafeMotion);
  const shown = useWalk(state, !safe);
  const actor = state.players[state.turnIndex] ?? null;

  /* Обработчик касания стабилен, иначе `memo` на клетках не сработает. */
  const onTileRef = useRef(onTile);
  onTileRef.current = onTile;
  const handleTile = useCallback((index: number) => onTileRef.current?.(index), []);

  return (
    <div className="board2-wrap">
      <div className="board2">
        {BOARD.map((tile) => {
          const prop = state.properties[tile.index];
          const owner = prop?.ownerId
            ? state.players.find((p) => p.id === prop.ownerId)
            : null;
          return (
            <PlainTile
              key={tile.index}
              tile={tile}
              ownerColor={owner?.color}
              ownerEmoji={owner?.emoji}
              mortgaged={!!prop?.mortgaged}
              houses={prop?.houses ?? 0}
              highlight={highlight === tile.index}
              onTile={handleTile}
            />
          );
        })}

        <div className="board2-center">
          {state.market && (
            <div className="b2-season">
              {seasonOf(state.market.month).emoji} {MONTHS[state.market.month - 1]}, год{' '}
              {state.market.year} · 🏛️ {state.market.keyRate} %
            </div>
          )}
          {state.dice && <Dice values={state.dice} />}
          {actor && (
            <div className="b2-actor">
              {actor.emoji} {actor.name}
            </div>
          )}
          <div className="b2-note">{state.log[0]?.text ?? 'Бросайте кубики'}</div>
          <div className="b2-tools">
            <BoardToggle />
          </div>
        </div>

        {state.players
          .filter((p) => !p.bankrupt)
          .map((p) => {
            const at = shown[p.id] ?? p.pos;
            const c = tileCenter(at);
            const slot = slotOn(state, p, shown);
            /* Фишки на одной клетке разводим в экранных пикселях, а не в
               координатах доски: доска ужата почти втрое, и сдвиг «по-доске»
               на телефоне превратился бы в пару пикселей — фишки слиплись бы
               в одну. Пока фишка на клетке одна, она стоит ровно по центру. */
            const alone = state.players.every(
              (o) => o.id === p.id || o.bankrupt || (shown[o.id] ?? o.pos) !== at,
            );
            const dx = alone ? 0 : ((slot % 3) - 1) * 15;
            const dy = alone ? 0 : (Math.floor(slot / 3) % 2 === 0 ? -1 : 1) * 8;
            return (
              <div
                key={p.id}
                className={`b2-pawn ${p.id === actor?.id ? 'on' : ''}`}
                style={{
                  left: `${(c.x / BOARD_PX) * 100}%`,
                  top: `${(c.y / BOARD_PX) * 100}%`,
                  background: p.color,
                  transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`,
                  zIndex: 20 + slot,
                }}
              >
                {p.emoji}
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* Клетка перерисовывается, только когда изменилась она сама, а не при
   каждом чужом ходе: во время движения фишки состояние меняется одиннадцать
   раз в секунду. */
const PlainTile = memo(function PlainTile({
  tile,
  ownerColor,
  ownerEmoji,
  mortgaged,
  houses,
  highlight,
  onTile,
}: {
  tile: Tile;
  ownerColor?: string;
  ownerEmoji?: string;
  mortgaged: boolean;
  houses: number;
  highlight: boolean;
  onTile: (index: number) => void;
}) {
  const rect = tileRect(tile.index);

  const classes = ['b2-tile', `b2-${rect.side}`];
  if (mortgaged) classes.push('mortgaged');
  if (highlight) classes.push('hi');

  return (
    <div
      className={classes.join(' ')}
      style={{
        left: `${(rect.x / BOARD_PX) * 100}%`,
        top: `${(rect.y / BOARD_PX) * 100}%`,
        width: `${(rect.w / BOARD_PX) * 100}%`,
        height: `${(rect.h / BOARD_PX) * 100}%`,
        background: ownerColor ? mix(ownerColor) : undefined,
      }}
      onClick={() => onTile(tile.index)}
    >
      {tile.group && (
        <div className="b2-band" style={{ background: GROUP_COLORS[tile.group] }} />
      )}
      {tile.emoji && <span className="b2-emoji">{tile.emoji}</span>}
      {ownerEmoji && <span className="b2-own">{ownerEmoji}</span>}
      {houses > 0 && (
        <span className={`b2-house ${houses >= 6 ? 'tower' : houses === 5 ? 'hotel' : ''}`}>
          {houses >= 6 ? '🏙' : houses === 5 ? '🏨' : houses}
        </span>
      )}
    </div>
  );
});

/**
 * Цвет владельца поверх кремового поля клетки — заметно, но не кричаще.
 *
 * Смешиваем числами, а не через `color-mix`: WebView на телефоне бывает
 * старее браузера на компьютере, и незнакомая функция там даёт не блёклый
 * оттенок, а прозрачную клетку.
 */
const PAPER = [242, 234, 214];

function mix(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#f2ead6';
  const n = parseInt(m[1], 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const out = rgb.map((v, i) => Math.round(v * 0.34 + PAPER[i] * 0.66));
  return `rgb(${out[0]}, ${out[1]}, ${out[2]})`;
}

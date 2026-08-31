import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BOARD, GROUP_COLORS, isBuyable } from '../../game/board';
import { moneyShort } from '../../game/money';
import type { GameState, Player, Tile } from '../../game/types';
import {
  BOARD_PX,
  TILT_DEG,
  pawnSpot,
  sideOf,
  tileCenter,
  tileRect,
} from './boardGeometry';
import { slotOn, useWalk } from './boardMotion';
import { BoardToggle } from './BoardToggle';
import { Dice } from './Dice';
import { BoardPlain } from './BoardPlain';
import { Critter } from './Critter';
import { SafeMotion } from './Shell';
import { useApp } from '../../store/appStore';
import { diag } from '../../lib/diag';
import { tap } from '../../lib/feedback';

/**
 * Доска.
 *
 * Главное решение: доска НЕ ужимается под экран. Она всегда 1100×1100
 * логических пикселей, а телефон смотрит на неё камерой, которая едет за
 * активной фишкой. Именно поэтому названия улиц читаются — раньше сорок
 * клеток втискивались в 480 пикселей и подписи выходили по 6,5 пикселя.
 *
 * Объём даёт наклон в 42° с настоящей перспективой: у доски видна толщина,
 * дома стоят коробочками, фигурки стоят вертикально и отбрасывают тень.
 */

/** Сколько логических пикселей держим в кадре в режиме слежения. */
const FOLLOW_SPAN = 380;
/** Обзор кладём доску положе: так она не сжимается в узкую полоску. */
const OVERVIEW_TILT = 28;
/*
 * Потолок приближения. Держим его низким намеренно: доску браузер
 * растрирует в один слой размером доска × масштаб × плотность экрана, и на
 * телефоне с плотным экраном при большом приближении этот слой перестаёт
 * помещаться в память — доска начинает пропадать кусками.
 */
const MAX_ZOOM = 1.8;

type CameraMode = 'follow' | 'overview' | 'free';

interface BoardProps {
  state: GameState;
  highlight?: number | null;
  onTile?: (index: number) => void;
}

/**
 * Какую доску показать. Это не два оформления одной и той же сцены, а две
 * разные отрисовки: объёмная живёт в трёхмерном контексте с камерой,
 * плоская — обычные прямоугольники без единого слоя. Поэтому и переключение
 * идёт здесь, а не классом на общем корне.
 */
export function Board(props: BoardProps) {
  const quality = useApp((s) => s.boardQuality);
  if (quality === 'fast') return <BoardPlain {...props} />;
  return <Board3D {...props} />;
}

function Board3D({ state, highlight, onTile }: BoardProps) {
  const safe = useContext(SafeMotion);
  const viewportRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(viewportRef);
  const shown = useWalk(state, !safe);

  const actor = state.players[state.turnIndex] ?? null;
  const focusTile = actor ? shown[actor.id] ?? actor.pos : 0;

  /* Обзор считается точно, а не подгоняется замерами: наклонённая доска в
     перспективе — трапеция, её проекцию можно посчитать формулой. */
  const overview = useMemo(
    () => fitOverview(size.w, size.h, OVERVIEW_TILT),
    [size.w, size.h],
  );
  const fitZoom = overview.zoom;


  const followZoom = useMemo(() => {
    if (!size.w || !size.h) return 0.3;
    const wanted = Math.min(size.w, size.h) / FOLLOW_SPAN;
    return Math.max(fitZoom, Math.min(wanted, MAX_ZOOM));
  }, [size.w, size.h, fitZoom]);

  const [mode, setMode] = useState<CameraMode>(safe ? 'overview' : 'follow');
  const tilt = mode === 'overview' || safe ? OVERVIEW_TILT : TILT_DEG;
  const pinned = useApp((s) => s.qualityPinned);
  useFrameWatch(!safe && !pinned);
  const [free, setFree] = useState({ x: BOARD_PX / 2, y: BOARD_PX / 2, zoom: 0 });

  /* Куда смотрит камера. В слежении — на активную фишку, слегка подтянутую
     к центру доски, чтобы рядом было видно соседние клетки. */
  const target = useMemo(() => {
    if (mode === 'free') return { ...free, zoom: free.zoom || followZoom };
    if (mode === 'overview' || safe) {
      // Перспектива растягивает ближний край вниз, поэтому геометрический
      // центр доски оказывается ниже центра кадра — компенсируем сдвигом.
      return { x: BOARD_PX / 2, y: overview.y, zoom: overview.zoom };
    }
    /* Камера смотрит прямо на активную клетку, лишь слегка подтянувшись
       к центру доски. Прижимать её к краям доски бессмысленно: доска —
       кольцо, и «заполнить кадр» означало бы залить его зелёным сукном. */
    const c = tileCenter(focusTile);
    return {
      x: c.x * 0.86 + (BOARD_PX / 2) * 0.14,
      y: c.y * 0.86 + (BOARD_PX / 2) * 0.14,
      zoom: followZoom,
    };
  }, [mode, free, focusTile, overview, followZoom, safe, size.w, size.h]);

  /* Центр кадра задан в CSS (left/top: 50%), поэтому здесь остаётся только
     довернуть, отмасштабировать и подвести доску нужной точкой.

     Камера двигается обычным переходом CSS, а не пружиной: значение
     трансформации всегда ровно то, что мы посчитали, и вписывание доски
     в кадр меряется по факту без гонки с анимацией. */
  const transform =
    `scale(${target.zoom}) rotateX(${tilt}deg) ` +
    `translate(${-target.x}px, ${-target.y}px)`;

  /* Обработчик касания не должен меняться от рендера к рендеру: иначе
     `memo` на клетках не сработает ни разу. Прячем изменчивое в ссылки. */
  const gesturesRef = useRef<{ moved: () => boolean } | null>(null);
  const onTileRef = useRef(onTile);
  onTileRef.current = onTile;
  const handleTile = useCallback((index: number) => {
    if (gesturesRef.current?.moved()) return;
    onTileRef.current?.(index);
  }, []);

  const gestures = usePanZoom({
    disabled: safe,
    getCamera: () => ({ x: target.x, y: target.y, zoom: target.zoom }),
    onChange: (next) => {
      setMode('free');
      setFree({ x: next.x, y: next.y, zoom: clamp(next.zoom, fitZoom * 0.9, MAX_ZOOM) });
    },
  });
  gesturesRef.current = gestures;

  return (
    <div
      className="board-viewport"
      ref={viewportRef}
      style={{ ['--tilt' as string]: `${tilt}deg` }}
      {...gestures.handlers}
    >
      <div
        className="board-stage"
        style={{
          transform,
          width: BOARD_PX,
          height: BOARD_PX,
          transition:
            safe || mode === 'free' ? 'none' : 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div className="board-slab" />
        <div className="board-felt" />

        {BOARD.map((tile) => {
          const prop = state.properties[tile.index];
          const owner = prop?.ownerId
            ? state.players.find((p) => p.id === prop.ownerId)
            : null;
          return (
            <TileView
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

        {mode !== 'follow' && <BoardCenter state={state} />}

        {state.players
          .filter((p) => !p.bankrupt)
          .map((p) => (
            <Pawn
              key={p.id}
              player={p}
              index={shown[p.id] ?? p.pos}
              slot={slotOn(state, p, shown)}
              active={p.id === actor?.id}
            />
          ))}
      </div>

      {mode === 'follow' && (
        <div className="board-hud">
          {state.dice && <Dice values={state.dice} />}
          <div className="board-hud-note">{state.log[0]?.text ?? 'Бросайте кубики'}</div>
        </div>
      )}

      <div className="board-tools">
        <button
          className={`board-tool ${mode === 'overview' ? 'on' : ''}`}
          onClick={() => {
            tap();
            setMode(mode === 'overview' ? 'follow' : 'overview');
          }}
        >
          {mode === 'overview' ? '🔍 К фишке' : '🗺️ Вся доска'}
        </button>
        {mode === 'free' && (
          <button
            className="board-tool"
            onClick={() => {
              tap();
              setMode('follow');
            }}
          >
            ⤢ К фишке
          </button>
        )}
        <BoardToggle />
      </div>
    </div>
  );
}

/* ───────────────────────────── клетка ───────────────────────────── */

/*
 * Клетка перерисовывается, только если изменилась она сама.
 *
 * Раньше сюда передавалось всё состояние партии, и любое действие — а во
 * время хода фишки состояние меняется одиннадцать раз в секунду — заставляло
 * React заново обходить все сорок клеток со всей их начинкой. Теперь клетка
 * получает ровно то, от чего зависит её вид.
 */
const TileView = memo(function TileView({
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
  const side = sideOf(tile.index);

  const classes = ['t3', `t3-${side}`];
  if (mortgaged) classes.push('mortgaged');
  if (highlight) classes.push('highlight');
  if (ownerColor) classes.push('owned');

  return (
    <div
      className={classes.join(' ')}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      onClick={() => onTile(tile.index)}
    >
      {tile.group && (
        <div className="t3-band" style={{ background: GROUP_COLORS[tile.group] }} />
      )}

      {/* Владение видно сразу: лицо клетки окрашивается в цвет хозяина. */}
      {ownerColor && <div className="t3-own" style={{ background: ownerColor }} />}

      <div className="t3-face">
        {tile.emoji && <span className="t3-emoji">{tile.emoji}</span>}
        <span className="t3-name">{tile.short}</span>
        {side !== 'corner' && isBuyable(tile) && tile.price && (
          <span className="t3-price">{moneyShort(tile.price)}</span>
        )}
      </div>

      {houses > 0 && <Buildings houses={houses} />}

      {/* Флажок с эмодзи владельца — понятно, с кем идти на обмен. */}
      {ownerColor && (
        <div className="t3-flag" style={{ ['--flag' as string]: ownerColor }}>
          <span>{ownerEmoji}</span>
        </div>
      )}
    </div>
  );
});

function Buildings({ houses }: { houses: number }) {
  if (houses >= 6) return <div className="t3-builds"><i className="tower" /></div>;
  if (houses === 5) return <div className="t3-builds"><i className="hotel" /></div>;
  return (
    <div className="t3-builds">
      {Array.from({ length: houses }).map((_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}

/* ───────────────────────────── фишка ───────────────────────────── */

const Pawn = memo(function Pawn({
  player,
  index,
  slot,
  active,
}: {
  player: Player;
  index: number;
  slot: number;
  active: boolean;
}) {
  const spot = pawnSpot(index, slot);

  return (
    <div
      className={`pawn ${active ? 'active' : ''}`}
      style={{ transform: `translate3d(${spot.x}px, ${spot.y}px, 0)` }}
    >
      <div className="pawn-mark" style={{ background: player.color }} />
      <div className="pawn-stand">
        <Critter
          characterId={player.character}
          outfit={player.outfit}
          accent={player.color}
          size={46}
          /*
           * На доске фигурки стоят смирно.
           *
           * Дыхание и моргание нарисованы преобразованиями внутри SVG, а такие
           * браузер не умеет крутить отдельным слоем: каждый кадр он заново
           * рисовал всю трёхмерную сцену — сорок клеток с домиками и флажками.
           * Одной шевелящейся фигурки хватало, чтобы доска не отдыхала никогда.
           * Микро-движения остались там, где сцена не мешает: на главном
           * экране и в бутике.
           */
          animate={false}
        />
      </div>
    </div>
  );
});

/* ───────────────────────────── центр ───────────────────────────── */

function BoardCenter({ state }: { state: GameState }) {
  const actor = state.players[state.turnIndex];

  return (
    <div className="board-center">
      <div className="board-logo">Монополия</div>
      {state.dice && <Dice values={state.dice} />}
      {actor && (
        <div className="center-strong">
          {actor.emoji} {actor.name}
        </div>
      )}
      <div className="center-note">{state.log[0]?.text ?? 'Бросайте кубики'}</div>
    </div>
  );
}

/* ───────────────────────────── жесты ───────────────────────────── */

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Перетаскивание одним пальцем и щипок двумя. */
function usePanZoom({
  disabled,
  getCamera,
  onChange,
}: {
  disabled: boolean;
  getCamera: () => Camera;
  onChange: (next: Camera) => void;
}) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ camera: Camera; cx: number; cy: number; dist: number } | null>(null);
  const movedRef = useRef(false);

  const reset = useCallback(() => {
    start.current = null;
  }, []);

  const gather = () => {
    const pts = [...pointers.current.values()];
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const dist =
      pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    return { cx, cy, dist };
  };

  if (disabled) {
    return { handlers: {}, moved: () => false };
  }

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      movedRef.current = false;
      const g = gather();
      start.current = { camera: getCamera(), cx: g.cx, cy: g.cy, dist: g.dist };
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId) || !start.current) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gather();
      const s = start.current;

      const dx = g.cx - s.cx;
      const dy = g.cy - s.cy;
      if (Math.hypot(dx, dy) > 7) movedRef.current = true;

      let zoom = s.camera.zoom;
      if (s.dist > 0 && g.dist > 0) {
        zoom = s.camera.zoom * (g.dist / s.dist);
        if (Math.abs(g.dist - s.dist) > 10) movedRef.current = true;
      }

      // Экранный сдвиг переводим в плоскость доски: по вертикали она сжата наклоном.
      const squash = Math.cos((TILT_DEG * Math.PI) / 180);
      onChange({
        x: s.camera.x - dx / zoom,
        y: s.camera.y - dy / (zoom * squash),
        zoom,
      });
    },
    onPointerUp: (e: React.PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 0) reset();
      else {
        const g = gather();
        start.current = { camera: getCamera(), cx: g.cx, cy: g.cy, dist: g.dist };
      }
    },
    onPointerCancel: (e: React.PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 0) reset();
    },
  };

  return { handlers, moved: () => movedRef.current };
}

/* ───────────────────────────── присмотр за плавностью ─────────────────────────
   Телефоны разные, и заранее не угадать, потянет ли конкретный трёхмерную
   доску. Поэтому не гадаем, а меряем: если кадры идут рывками, доска сама
   ложится плоско. Обратно само не включается — только руками в настройках. */

/** Кадр дольше сорока миллисекунд — это уже видимый рывок. */
const SLOW_FRAME_MS = 40;
const SAMPLE_FRAMES = 90;
const BAD_SHARE = 0.35;

function useFrameWatch(active: boolean) {
  const setBoardQuality = useApp((s) => s.setBoardQuality);
  const done = useRef(false);

  useEffect(() => {
    if (!active || done.current) return;
    if (typeof requestAnimationFrame === 'undefined') return;

    let frames = 0;
    let slow = 0;
    let last = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      // Первый кадр после простоя всегда длинный — он ничего не говорит.
      if (delta < 400) {
        frames += 1;
        if (delta > SLOW_FRAME_MS) slow += 1;
      }
      if (frames < SAMPLE_FRAMES) {
        raf = requestAnimationFrame(tick);
        return;
      }
      done.current = true;
      if (slow / frames > BAD_SHARE) {
        diag('доска', `упрощена: ${slow} рывков из ${frames} кадров`);
        setBoardQuality('fast', true);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, setBoardQuality]);
}

/* ───────────────────────────── вписывание обзора ─────────────────────────────

   Наклонённая доска проецируется трапецией: ближний край шире и ниже
   дальнего, а видимый центр не совпадает с геометрическим. Раньше это
   подгонялось замерами по факту — и расходилось, потому что каждая правка
   меняла саму проекцию. Теперь проекция считается формулой, а неизвестные
   (масштаб и точка фокуса) доводятся несколькими итерациями в числах.
   Никакого DOM, никакой гонки с анимацией. */

const PERSPECTIVE = 1500;

function fitOverview(w: number, h: number, tiltDeg: number): { zoom: number; y: number } {
  if (!w || !h) return { zoom: 0.3, y: BOARD_PX / 2 };

  const t = (tiltDeg * Math.PI) / 180;
  const sin = Math.sin(t);
  const cos = Math.cos(t);
  const d = PERSPECTIVE;
  const half = BOARD_PX / 2;
  const roomW = w * 0.96;
  const roomH = h * 0.94;

  let zoom = Math.min(roomW, roomH) / BOARD_PX;
  let y = BOARD_PX / 2;

  /** Во сколько раз перспектива увеличивает ряд, отстоящий от фокуса на v. */
  const k = (v: number) => d / Math.max(d * 0.2, d - zoom * v * sin);

  for (let i = 0; i < 24; i++) {
    const far = -y;
    const near = BOARD_PX - y;

    // Ширину задаёт ближний край — он самый крупный.
    const byWidth = roomW / (2 * half * k(near));
    const top = zoom * far * cos * k(far);
    const bottom = zoom * near * cos * k(near);
    const byHeight = (roomH / Math.max(1, bottom - top)) * zoom;
    zoom += (Math.min(byWidth, byHeight) - zoom) * 0.6;

    // Сместить точку фокуса так, чтобы верхний и нижний зазоры сравнялись.
    const drift = (zoom * -y * cos * k(-y) + zoom * (BOARD_PX - y) * cos * k(BOARD_PX - y)) / 2;
    y += (drift / (zoom * cos)) * 0.6;
  }

  // У доски есть толщина: тёмная плита выступает снизу и зрительно тянет
  // картинку вниз. Небольшой довесок возвращает её в середину кадра.
  return { zoom, y: y + 44 };
}

/* ───────────────────────────── размеры ───────────────────────────── */

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setSize((prev) =>
        prev.w === el.clientWidth && prev.h === el.clientHeight
          ? prev
          : { w: el.clientWidth, h: el.clientHeight },
      );
    measure();
    // Экран въезжает анимацией — первая мерка может застать промежуточный кадр.
    const raf = requestAnimationFrame(measure);
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(raf);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [ref]);

  return size;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

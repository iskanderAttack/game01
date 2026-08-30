import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useActivePlayer, useApp, useCurrentView } from '../../store/appStore';
import { autoPlace, canPlace, emptyBoard, forbiddenCells, makeShip, rotated, shipCells } from '../../game/board';
import { getFleet } from '../../game/fleet';
import { getMode } from '../../game/modes';
import { key } from '../../game/coords';
import { Screen, TopBar } from '../components/Shell';
import { Board } from '../components/Board';
import { ShipDock, dockEntries } from '../components/ShipDock';
import { PassDevice } from '../components/PassDevice';
import { submitFleetEverywhere } from '../../net/bridge';
import { haptic, play, tap } from '../../lib/feedback';
import type { Board as BoardModel, Coord, Orientation, Ship } from '../../game/types';

export function PlacementScreen() {
  const netRole = useApp((s) => s.netRole);
  const game = useApp((s) => s.game);
  const settings = useApp((s) => s.settings);
  const view = useCurrentView();
  const active = useActivePlayer();
  const quitGame = useApp((s) => s.quitGame);

  const autoPlaceFor = useApp((s) => s.autoPlaceFor);
  const placeShipStore = useApp((s) => s.placeShip);
  const rotateShipStore = useApp((s) => s.rotateShip);
  const clearBoardStore = useApp((s) => s.clearBoard);

  const isClient = netRole === 'client';
  const boardSize = view?.settings.boardSize ?? settings.boardSize;
  const fleetId = view?.settings.fleetId ?? settings.fleetId;
  const allowTouching = view?.settings.allowTouching ?? settings.allowTouching;
  const fleet = getFleet(fleetId);
  const mode = getMode(view?.settings.modeId ?? settings.modeId);

  /* Клиент собирает флот у себя и отправляет хосту только готовую расстановку. */
  const [localBoard, setLocalBoard] = useState<BoardModel>(() => emptyBoard(boardSize));
  useEffect(() => {
    if (isClient) setLocalBoard(emptyBoard(boardSize));
  }, [isClient, boardSize]);

  const board: BoardModel | null = isClient ? localBoard : active?.board ?? null;
  const playerId = isClient ? view?.me.id ?? '' : active?.id ?? '';
  const submitted = isClient ? !!view?.me.ready : !!active?.ready;

  const [size, setSize] = useState<number | null>(null);
  const [dir, setDir] = useState<Orientation>('h');
  const [hover, setHover] = useState<Coord | null>(null);
  const [gateFor, setGateFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entries = useMemo(
    () => dockEntries(fleet.sizes, board?.ships ?? []),
    [fleet.sizes, board?.ships],
  );

  // Автоматически берём в руку самый крупный из нерасставленных.
  useEffect(() => {
    const next = entries.find((e) => e.placed < e.total);
    if (!next) {
      setSize(null);
      return;
    }
    if (size === null || (entries.find((e) => e.size === size)?.placed ?? 0) >= (entries.find((e) => e.size === size)?.total ?? 0)) {
      setSize(next.size);
    }
  }, [entries, size]);

  const forbidden = useMemo(
    () => (board ? forbiddenCells(board, allowTouching) : new Set<string>()),
    [board, allowTouching],
  );

  const preview = useMemo(() => {
    if (!board || !hover || size === null) return null;
    const ship = makeShip(size, hover.x, hover.y, dir);
    return { cells: shipCells(ship), ok: canPlace(board, ship, allowTouching) };
  }, [board, hover, size, dir, allowTouching]);

  if (!board || !playerId) {
    return (
      <Screen name="placement">
        <div className="card center" style={{ padding: 30, marginTop: 40 }}>
          <div className="shimmer" style={{ fontSize: 36 }}>⚓</div>
          <div className="net-title" style={{ marginTop: 12 }}>Готовим карты</div>
          <p className="muted" style={{ marginTop: 6 }}>Ждём данные партии.</p>
          <button className="btn block" style={{ marginTop: 18 }} onClick={() => { tap(); quitGame(); }}>
            На главный экран
          </button>
        </div>
      </Screen>
    );
  }

  const allPlaced = board.ships.length === fleet.sizes.length;
  const needsGate = netRole === 'local' && (game?.players.filter((p) => !p.isBot && !p.remote).length ?? 0) > 1;
  const showGate = needsGate && !submitted && gateFor !== playerId;

  /* ─────────────────────────── действия ─────────────────────────── */

  const applyLocal = (mutate: (b: BoardModel) => BoardModel | null) => {
    const next = mutate({ ...localBoard, ships: [...localBoard.ships] });
    if (next) setLocalBoard(next);
    return !!next;
  };

  const doPlace = (c: Coord) => {
    if (size === null) return;
    const ship = makeShip(size, c.x, c.y, dir);

    const ok = isClient
      ? applyLocal((b) => (canPlace(b, ship, allowTouching) ? { ...b, ships: [...b.ships, ship] } : null))
      : placeShipStore(playerId, size, c.x, c.y, dir);

    if (ok) {
      play('place');
      haptic('medium');
      setError(null);
    } else {
      haptic('error');
      setError('Сюда корабль не встаёт — мешает борт соседа или край поля');
    }
  };

  const doRotate = (shipId: string) => {
    const ok = isClient
      ? applyLocal((b) => {
          const ship = b.ships.find((s) => s.id === shipId);
          if (!ship) return null;
          const turned = rotated(ship);
          const without = { ...b, ships: b.ships.filter((s) => s.id !== shipId) };
          if (!canPlace(without, turned, allowTouching)) return null;
          return { ...b, ships: b.ships.map((s) => (s.id === shipId ? turned : s)) };
        })
      : rotateShipStore(playerId, shipId);

    if (ok) {
      play('rotate');
      haptic('light');
      setError(null);
    } else {
      haptic('warning');
      setError('Развернуть не выходит — не хватает места');
    }
  };

  const doAuto = () => {
    tap('select');
    const ships = autoPlace(boardSize, fleet.sizes, allowTouching);
    if (!ships) {
      setError('Не удалось разместить весь флот — увеличьте поле');
      return;
    }
    if (isClient) setLocalBoard({ ...emptyBoard(boardSize), ships });
    else autoPlaceFor(playerId);
    play('place');
    setError(null);
  };

  const doClear = () => {
    tap();
    if (isClient) setLocalBoard(emptyBoard(boardSize));
    else clearBoardStore(playerId);
    setError(null);
  };

  const doReady = () => {
    if (!allPlaced) return;
    tap('select');
    play('sonar');
    submitFleetEverywhere(playerId, board.ships as Ship[]);
    setGateFor(null);
  };

  /* ─────────────────────────── отрисовка ─────────────────────────── */

  const placedCount = board.ships.length;

  return (
    <Screen name="placement">
      <TopBar
        title="Расстановка"
        subtitle={`${mode.emoji} ${mode.name} · ${placedCount} из ${fleet.sizes.length}`}
        onBack={() => {
          tap();
          quitGame();
        }}
      />

      <div className="scroll">
        {submitted ? (
          <div className="card center" style={{ padding: 26 }}>
            <div className="shimmer" style={{ fontSize: 40 }}>⚓</div>
            <div className="net-title" style={{ marginTop: 12 }}>Флот на позиции</div>
            <p className="muted" style={{ marginTop: 6 }}>
              {netRole === 'local' ? 'Передайте телефон следующему игроку.' : 'Ждём остальных адмиралов…'}
            </p>
          </div>
        ) : (
          <>
            <div className="card stack" style={{ padding: 12 }}>
              <div className="row between">
                <span className="label">Флот в доке</span>
                <span className="chip">{fleet.emoji} {fleet.name}</span>
              </div>
              <ShipDock entries={entries} selected={size} onSelect={setSize} />
            </div>

            <Board
              size={boardSize}
              shots={board.shots}
              mode="placement"
              ships={board.ships}
              preview={preview}
              forbidden={forbidden}
              onHover={setHover}
              onAim={setHover}
              onCommit={doPlace}
              onShipTap={doRotate}
              commitOnRelease
            />

            {error && <div className="notice warn">{error}</div>}

            <div className="row">
              <button
                className="btn grow"
                onClick={() => {
                  tap('rotate');
                  setDir((d) => (d === 'h' ? 'v' : 'h'));
                }}
              >
                {dir === 'h' ? '↔ Поперёк' : '↕ Вдоль'}
              </button>
              <button className="btn grow" onClick={doAuto}>
                🎲 Авто
              </button>
              <button className="btn grow" onClick={doClear} disabled={placedCount === 0}>
                ✕ Сброс
              </button>
            </div>

            <div className="setting-hint" style={{ textAlign: 'center' }}>
              Выберите корабль в доке и коснитесь поля. Тап по стоящему кораблю разворачивает его.
            </div>
          </>
        )}
      </div>

      {!submitted && (
        <button className="btn primary block" disabled={!allPlaced} onClick={doReady}>
          {allPlaced ? 'Флот готов к бою →' : `Осталось расставить: ${fleet.sizes.length - placedCount}`}
        </button>
      )}

      <AnimatePresence>
        {showGate && active && (
          <PassDevice
            name={active.name}
            emoji={active.emoji}
            color={active.color}
            note="Расставьте свой флот так, чтобы соперники не подглядели."
            onReady={() => setGateFor(playerId)}
          />
        )}
      </AnimatePresence>
    </Screen>
  );
}

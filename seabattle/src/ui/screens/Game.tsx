import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useApp, useCurrentView, useNeedsHandoff } from '../../store/appStore';
import { getAbility } from '../../game/abilities';
import { getMode } from '../../game/modes';
import { cellName } from '../../game/coords';
import { NONE, type Coord, type ShotRecord } from '../../game/types';
import { Screen, Sheet } from '../components/Shell';
import { Board } from '../components/Board';
import { AbilityBar, EnergyBar } from '../components/AbilityBar';
import { TargetStrip } from '../components/TargetStrip';
import { PassDevice } from '../components/PassDevice';
import { Avatar, FleetStrip } from '../components/PlayerBits';
import { castEverywhere, fireEverywhere, selectTargetEverywhere } from '../../net/bridge';
import { haptic, play, tap } from '../../lib/feedback';

export function GameScreen() {
  const view = useCurrentView();
  const feed = useApp((s) => s.feed);
  const quitGame = useApp((s) => s.quitGame);
  const handoff = useNeedsHandoff();

  const [aim, setAim] = useState<Coord | null>(null);
  const [ability, setAbility] = useState<string | null>(null);
  const [lineAxis, setLineAxis] = useState<'row' | 'col'>('row');
  const [gateFor, setGateFor] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [alarm, setAlarm] = useState(0);
  const [left, setLeft] = useState(0);

  const turnOfId = view?.turnOfId ?? null;
  const myTurn = !!view && turnOfId === view.me.id;
  const timer = view?.settings.timer ?? 0;
  const prevTurnRef = useRef<string | null>(null);
  const seenLogRef = useRef(0);

  /* Сброс прицела и способности при смене хода. */
  useEffect(() => {
    setAim(null);
    setAbility(null);
    setNotice(null);
    if (turnOfId && prevTurnRef.current !== turnOfId) {
      prevTurnRef.current = turnOfId;
      if (myTurn) play('turn');
    }
  }, [turnOfId, myTurn]);

  /*
   * Озвучиваем результат по журналу, а не по факту нажатия.
   *
   * Только так звук совпадает с реальным исходом: попал, потопил или
   * промахнулся. Заодно ловим чужие залпы по нам — по ним даём тревогу.
   */
  const logLength = view?.log.length ?? 0;
  useEffect(() => {
    if (!view) return;
    if (logLength < seenLogRef.current) seenLogRef.current = 0;
    const fresh = view.log.slice(seenLogRef.current);
    seenLogRef.current = logLength;
    if (fresh.length === 0) return;

    for (const r of fresh) soundFor(r, view.me.id, () => setAlarm((n) => n + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logLength]);

  /* Таймер хода: время вышло — стреляем в первую свободную клетку. */
  useEffect(() => {
    if (!timer || !myTurn || !view) return;
    setLeft(timer);
    const id = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(id);
          autoShot();
          return 0;
        }
        if (v <= 4) play('tick');
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnOfId, timer, myTurn]);

  const enemies = view?.enemies ?? [];
  const target = useMemo(
    () => enemies.find((e) => e.id === view?.targetId) ?? enemies.find((e) => e.alive) ?? null,
    [enemies, view?.targetId],
  );

  const selectedAbility = ability ? getAbility(ability) : null;

  if (!view) {
    return (
      <Screen name="game">
        <div className="card center" style={{ padding: 30, marginTop: 40 }}>
          <div className="shimmer" style={{ fontSize: 36 }}>⚓</div>
          <div className="net-title" style={{ marginTop: 12 }}>Ждём бой</div>
          <p className="muted" style={{ marginTop: 6 }}>Хост ещё не прислал обстановку.</p>
          <button className="btn block" style={{ marginTop: 18 }} onClick={() => { tap(); quitGame(); }}>
            На главный экран
          </button>
        </div>
      </Screen>
    );
  }

  const mode = getMode(view.settings.modeId);
  const turnPlayer = view.me.id === turnOfId ? view.me : enemies.find((e) => e.id === turnOfId) ?? null;
  const showGate = handoff && myTurn && gateFor !== `${turnOfId}-${view.turn}` && view.phase === 'playing';
  const needsOwnBoard = selectedAbility?.target === 'ownCell';
  // Крупные поля рисуем плотнее, иначе два поля не помещаются на экран.
  const dense = view.settings.boardSize >= 11;

  /* ─────────────────────────── действия ─────────────────────────── */

  function autoShot() {
    if (!view || !target) return;
    for (let y = 0; y < target.board.size; y++) {
      for (let x = 0; x < target.board.size; x++) {
        if (target.board.shots[y][x] === NONE) {
          fireEverywhere(x, y);
          return;
        }
      }
    }
  }

  const canShoot = (c: Coord) => !!target && target.alive && target.board.shots[c.y]?.[c.x] === NONE;

  const doFire = (c: Coord) => {
    if (!myTurn || !target || !canShoot(c)) return;
    fireEverywhere(c.x, c.y);
    setAim(null);
  };

  const doAbility = (c?: Coord) => {
    if (!selectedAbility || !view) return;
    const params: Record<string, unknown> = { targetId: target?.id };

    switch (selectedAbility.target) {
      case 'enemyCell':
        if (!c) return;
        params.x = c.x;
        params.y = c.y;
        break;
      case 'enemyLine':
        if (!c) return;
        params.axis = lineAxis;
        params.index = lineAxis === 'row' ? c.y : c.x;
        break;
      case 'ownCell':
        if (!c) return;
        params.x = c.x;
        params.y = c.y;
        params.targetId = view.me.id;
        break;
      case 'enemyBoard':
      case 'self':
        break;
    }

    const error = castEverywhere(selectedAbility.id, params);
    if (error) {
      haptic('error');
      setNotice(error);
      return;
    }
    play(selectedAbility.id === 'mine' ? 'mine' : 'sonar');
    haptic('success');
    setAbility(null);
    setAim(null);
    setNotice(null);
  };

  /** Первый тап ставит жёлтый прицел, второй по той же клетке — стреляет. */
  const onEnemyTap = (c: Coord) => {
    if (!myTurn) return;

    if (selectedAbility) {
      if (selectedAbility.target === 'ownCell') return;
      doAbility(c);
      return;
    }

    if (!canShoot(c)) {
      haptic('warning');
      setNotice('Сюда уже стреляли');
      return;
    }

    if (aim && aim.x === c.x && aim.y === c.y) {
      doFire(c);
      return;
    }

    setAim(c);
    setNotice(null);
    play('select');
    haptic('light');
  };

  const onOwnTap = (c: Coord) => {
    if (!myTurn || !needsOwnBoard) return;
    doAbility(c);
  };

  /* ─────────────────────────── отрисовка ─────────────────────────── */

  return (
    <Screen name="game" className="battle">
      {/* Шапки нет: её место занимают поля. */}
      <div className={`battle-top ${myTurn ? 'mine' : ''}`}>
        {turnPlayer && <Avatar emoji={turnPlayer.emoji} color={turnPlayer.color} size={34} />}
        <div className="grow">
          <div className="who">{myTurn ? 'Ваш залп' : `Ходит ${turnPlayer?.name ?? '…'}`}</div>
          <div className="note">
            {mode.emoji} ход {view.turn}
            {timer > 0 && myTurn ? ` · ${left} с` : ''}
            {selectedAbility ? ` · ${selectedAbility.emoji} ${selectedAbility.name}` : ''}
          </div>
        </div>
        {view.settings.abilities && <EnergyBar energy={view.me.energy} />}
        <button className="icon-btn" onClick={() => { tap(); setMenuOpen(true); }} aria-label="Меню">
          ⋯
        </button>
      </div>

      <div className="battle-body">
        {enemies.length > 1 && (
          <TargetStrip enemies={enemies} targetId={target?.id ?? null} onPick={(id) => selectTargetEverywhere(id)} />
        )}

        {target ? (
          <>
            <div className="board-caption">
              <span>🎯 {target.name}</span>
              <span className="mono">{target.board.shipsLeft} на плаву</span>
            </div>
            <Board
              size={target.board.size}
              shots={target.board.shots}
              mode="enemy"
              sunk={target.board.sunk}
              intel={target.board.intel}
              aim={aim}
              onAim={() => {}}
              onCommit={onEnemyTap}
              commitOnRelease
              disabled={!myTurn || !target.alive || needsOwnBoard}
              wrapClass={dense ? 'dense' : ''}
            />
            <FleetStrip fleetId={view.settings.fleetId} sunk={target.board.sunk} />
          </>
        ) : (
          <div className="notice">Все соперники потоплены.</div>
        )}

        {notice && <div className="notice warn">{notice}</div>}

        {myTurn && !selectedAbility && (
          <div className="hint-line">
            {aim ? `Нажмите ${cellName(aim.x, aim.y)} ещё раз — залп` : 'Коснитесь клетки, чтобы прицелиться'}
          </div>
        )}

        {selectedAbility?.target === 'enemyLine' && (
          <div className="row">
            <button
              className={`btn grow small ${lineAxis === 'row' ? 'primary' : ''}`}
              onClick={() => { tap(); setLineAxis('row'); }}
            >
              ↔ По ряду
            </button>
            <button
              className={`btn grow small ${lineAxis === 'col' ? 'primary' : ''}`}
              onClick={() => { tap(); setLineAxis('col'); }}
            >
              ↕ По столбцу
            </button>
          </div>
        )}

        {selectedAbility && (selectedAbility.target === 'self' || selectedAbility.target === 'enemyBoard') && (
          <button className="btn primary block" onClick={() => doAbility()}>
            {selectedAbility.emoji} Применить «{selectedAbility.name}»
          </button>
        )}

        {/* Своё поле — всегда на виду, ниже вражеского. */}
        <div className="own-row">
          <div className="own-side board">
            <div className="board-caption">
              <span>⚓ Моя карта</span>
            </div>
            <Board
              size={view.me.board.size}
              shots={view.me.board.shots}
              mode="own"
              ships={view.me.board.ships}
              mines={view.me.board.mines}
              onCommit={onOwnTap}
              commitOnRelease={needsOwnBoard}
              disabled={!needsOwnBoard}
              showCoords={false}
              wrapClass="own"
            />
          </div>
          <div className="own-side info">
            <FleetStrip
              fleetId={view.settings.fleetId}
              sunk={view.me.board.ships
                .filter((s) => s.hits.every(Boolean))
                .map((s) => ({ size: s.size, x: s.x, y: s.y, dir: s.dir, role: s.role }))}
            />
            <div className="setting-hint">
              {needsOwnBoard
                ? `Выберите клетку для «${selectedAbility?.name}»`
                : `Целых кораблей: ${view.me.board.ships.filter((s) => !s.hits.every(Boolean)).length}`}
            </div>
          </div>
        </div>

        {view.settings.abilities && (
          <AbilityBar
            energy={view.me.energy}
            selected={ability}
            onSelect={(id) => {
              setAbility(id);
              setAim(null);
              setNotice(null);
            }}
            disabled={!myTurn}
          />
        )}
      </div>

      {/* Журнал спрятан вниз и открывается по требованию. */}
      <div className="battle-foot">
        <button className="foot-btn" onClick={() => { tap(); setLogOpen(true); }}>
          📜 Журнал
          {feed.length > 0 && <span className="foot-badge mono">{feed.length}</span>}
        </button>
      </div>

      {alarm > 0 && <div key={alarm} className="alarm-flash" />}

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Журнал боя">
        <div className="stack">
          {feed.length === 0 && <div className="muted">Пока ничего не произошло.</div>}
          {feed.map((line, i) => (
            <div key={i} className="feed-line">
              {line}
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={`${mode.emoji} ${mode.name}`}>
        <div className="stack">
          <div className="card">
            <span className="label">Обстановка</span>
            <div className="wrap" style={{ marginTop: 10 }}>
              <span className="chip">👥 {enemies.length + 1}</span>
              <span className="chip">
                🎯 точность{' '}
                {view.me.stats.shots ? Math.round((view.me.stats.hits / view.me.stats.shots) * 100) : 0}%
              </span>
              <span className="chip">💥 потоплено {view.me.stats.sunk}</span>
              {view.settings.abilities && <span className="chip">⚡ {view.me.energy}</span>}
            </div>
          </div>
          <button className="btn danger block" onClick={() => { setMenuOpen(false); quitGame(); }}>
            Выйти из боя
          </button>
        </div>
      </Sheet>

      <AnimatePresence>
        {showGate && (
          <PassDevice
            name={view.me.name}
            emoji={view.me.emoji}
            color={view.me.color}
            note="Ваш ход. Убедитесь, что соперники не смотрят в экран."
            onReady={() => setGateFor(`${turnOfId}-${view.turn}`)}
          />
        )}
      </AnimatePresence>
    </Screen>
  );
}

/** Звук и отдача по фактическому исходу выстрела. */
function soundFor(r: ShotRecord, meId: string, flashAlarm: () => void) {
  const mine = r.byId === meId;
  const atMe = r.targetId === meId;

  if (mine) {
    if (r.outcome === 'sunk') {
      play('sunk');
      haptic('heavy');
    } else if (r.outcome === 'hit') {
      play('hit');
      haptic('medium');
    } else if (r.outcome === 'mine') {
      play('mine');
      haptic('error');
    } else {
      play('splash');
      haptic('light');
    }
    return;
  }

  if (atMe) {
    // По нам попали — этот звук должен вырывать из размышлений.
    if (r.outcome === 'sunk') {
      play('alarmSunk');
      haptic('error');
      flashAlarm();
    } else if (r.outcome === 'hit') {
      play('alarm');
      haptic('warning');
      flashAlarm();
    } else if (r.outcome === 'miss') {
      play('splashFar');
    }
  }
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useApp, useCurrentView, useNeedsHandoff } from '../../store/appStore';
import { getAbility } from '../../game/abilities';
import { getMode } from '../../game/modes';
import { cellName } from '../../game/coords';
import { NONE, type Coord } from '../../game/types';
import { Screen, Sheet, TopBar } from '../components/Shell';
import { Board } from '../components/Board';
import { AbilityBar, EnergyBar } from '../components/AbilityBar';
import { TargetStrip } from '../components/TargetStrip';
import { PassDevice } from '../components/PassDevice';
import { Avatar, FleetStrip } from '../components/PlayerBits';
import { castEverywhere, fireEverywhere, selectTargetEverywhere } from '../../net/bridge';
import { haptic, play, tap } from '../../lib/feedback';

export function GameScreen() {
  const view = useCurrentView();
  const netRole = useApp((s) => s.netRole);
  const localPlayerId = useApp((s) => s.localPlayerId);
  const feed = useApp((s) => s.feed);
  const quitGame = useApp((s) => s.quitGame);
  const handoff = useNeedsHandoff();

  const [aim, setAim] = useState<Coord | null>(null);
  const [ability, setAbility] = useState<string | null>(null);
  const [lineAxis, setLineAxis] = useState<'row' | 'col'>('row');
  const [gateFor, setGateFor] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showOwn, setShowOwn] = useState(false);
  const [left, setLeft] = useState(0);

  const turnOfId = view?.turnOfId ?? null;
  const myTurn = !!view && turnOfId === view.me.id;
  const timer = view?.settings.timer ?? 0;
  const prevTurnRef = useRef<string | null>(null);

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
  const turnPlayer =
    view.me.id === turnOfId ? view.me : enemies.find((e) => e.id === turnOfId) ?? null;

  const showGate =
    handoff && myTurn && gateFor !== `${turnOfId}-${view.turn}` && view.phase === 'playing';

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

  const canShoot = (c: Coord) =>
    !!target && target.alive && target.board.shots[c.y]?.[c.x] === NONE;

  const doFire = (c: Coord) => {
    if (!myTurn || !target) return;
    if (!canShoot(c)) {
      haptic('warning');
      setNotice('Сюда уже стреляли — выберите другую клетку');
      return;
    }
    const wasHit = false; // результат придёт из состояния; звук даём по факту ниже
    haptic('medium');
    play('splash');
    void wasHit;
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

  const onBoardCommit = (c: Coord) => {
    if (!myTurn) return;
    if (selectedAbility) {
      if (selectedAbility.target === 'ownCell') return;
      doAbility(c);
      return;
    }
    if (view.settings.confirmShot) {
      setAim(c);
      haptic('light');
      return;
    }
    doFire(c);
  };

  const onOwnBoardCommit = (c: Coord) => {
    if (!myTurn || !selectedAbility) return;
    if (selectedAbility.target !== 'ownCell') return;
    doAbility(c);
  };

  /* ─────────────────────────── отрисовка ─────────────────────────── */

  const needsOwnBoard = selectedAbility?.target === 'ownCell';

  return (
    <Screen name="game">
      <TopBar
        title={`${mode.emoji} ${mode.name}`}
        subtitle={`Ход ${view.turn}${timer && myTurn ? ` · ${left} с` : ''}`}
        right={
          <button className="icon-btn" onClick={() => { tap(); setMenuOpen(true); }} aria-label="Меню">
            ⋯
          </button>
        }
      />

      <div className={`turn-banner ${myTurn ? 'mine' : ''}`}>
        {turnPlayer && <Avatar emoji={turnPlayer.emoji} color={turnPlayer.color} size={40} />}
        <div className="grow">
          <div className="turn-name">{myTurn ? 'Ваш залп' : `Ходит ${turnPlayer?.name ?? '…'}`}</div>
          <div className="turn-note">
            {myTurn
              ? selectedAbility
                ? `${selectedAbility.emoji} ${selectedAbility.name}: ${selectedAbility.short}`
                : target
                  ? `Цель — ${target.name}`
                  : 'Целей не осталось'
              : 'Ждём соперника…'}
          </div>
        </div>
        {view.settings.abilities && <EnergyBar energy={view.me.energy} />}
      </div>

      <div className="scroll">
        <TargetStrip
          enemies={enemies}
          targetId={target?.id ?? null}
          onPick={(id) => selectTargetEverywhere(id)}
        />

        {target ? (
          <>
            <div className="row between">
              <span className="label">Карта соперника — {target.name}</span>
              <span className="chip mono">{target.board.shipsLeft} 🚢</span>
            </div>
            <Board
              size={target.board.size}
              shots={target.board.shots}
              mode="enemy"
              sunk={target.board.sunk}
              intel={target.board.intel}
              aim={aim}
              onAim={setAim}
              onCommit={onBoardCommit}
              commitOnRelease
              disabled={!myTurn || !target.alive || needsOwnBoard}
            />
            <FleetStrip fleetId={view.settings.fleetId} sunk={target.board.sunk} />
          </>
        ) : (
          <div className="notice">Все соперники потоплены.</div>
        )}

        {notice && <div className="notice warn">{notice}</div>}

        {selectedAbility?.target === 'enemyLine' && (
          <div className="row">
            <button
              className={`btn grow ${lineAxis === 'row' ? 'primary' : ''}`}
              onClick={() => { tap(); setLineAxis('row'); }}
            >
              ↔ По ряду
            </button>
            <button
              className={`btn grow ${lineAxis === 'col' ? 'primary' : ''}`}
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

        {view.settings.abilities && (
          <>
            <span className="label">Штаб</span>
            <AbilityBar
              energy={view.me.energy}
              selected={ability}
              onSelect={(id) => {
                setAbility(id);
                setAim(null);
                setNotice(null);
                if (id && getAbility(id)?.target === 'ownCell') setShowOwn(true);
              }}
              disabled={!myTurn}
            />
          </>
        )}

        <button
          className="btn block"
          onClick={() => { tap(); setShowOwn((v) => !v); }}
        >
          {showOwn ? '▲ Скрыть мою карту' : '▼ Показать мою карту'}
        </button>

        {showOwn && (
          <>
            <div className="row between">
              <span className="label">Моя карта</span>
              <span className="chip mono">{view.me.board.ships.filter((s) => !s.hits.every(Boolean)).length} 🚢</span>
            </div>
            <Board
              size={view.me.board.size}
              shots={view.me.board.shots}
              mode="own"
              ships={view.me.board.ships}
              mines={view.me.board.mines}
              onCommit={onOwnBoardCommit}
              commitOnRelease={needsOwnBoard}
              disabled={!needsOwnBoard}
            />
            {needsOwnBoard && (
              <div className="notice">
                Выберите клетку на своём поле для «{selectedAbility?.name}».
              </div>
            )}
          </>
        )}

        {view.allies.length > 0 && (
          <>
            <span className="label">Эскадра</span>
            <div className="wrap">
              {view.allies.map((a) => (
                <span key={a.id} className="mini-player">
                  <Avatar emoji={a.emoji} color={a.color} size={24} ring={false} />
                  {a.name}
                </span>
              ))}
            </div>
          </>
        )}

        {feed.length > 0 && (
          <>
            <span className="label">Журнал боя</span>
            <div className="feed">
              {feed.slice(0, 8).map((line, i) => (
                <div key={i} className="feed-line">
                  {line}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {myTurn && !selectedAbility && view.settings.confirmShot && (
        <button
          className="btn primary block"
          disabled={!aim || !canShoot(aim)}
          onClick={() => aim && doFire(aim)}
        >
          {aim ? `🔥 Огонь — ${cellName(aim.x, aim.y)}` : 'Выберите клетку на карте соперника'}
        </button>
      )}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Бой">
        <div className="stack">
          <div className="card">
            <span className="label">Обстановка</span>
            <div className="wrap" style={{ marginTop: 10 }}>
              <span className="chip">👥 {enemies.length + 1}</span>
              <span className="chip">🎯 точность {view.me.stats.shots ? Math.round((view.me.stats.hits / view.me.stats.shots) * 100) : 0}%</span>
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

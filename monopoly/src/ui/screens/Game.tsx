import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp, useActor, useCanAct, useMe } from '../../store/appStore';
import {
  buildCost,
  canBuild,
  canMortgage,
  netWorth,
  ownedTiles,
  playerById,
  tileAt,
  type Action,
} from '../../game/engine';
import { JAIL_FEE } from '../../game/board';
import { getMode } from '../../game/modes';
import { money, moneyDelta } from '../../game/money';
import { act } from '../../net/bridge';
import { Screen, Sheet } from '../components/Shell';
import { Board } from '../components/Board';
import { PlayerStrip } from '../components/PlayerBits';
import { DeedCard, groupProgress } from '../components/PropertyBits';
import { TradeSheet } from '../components/TradeSheet';
import { haptic, play, tap } from '../../lib/feedback';

export function GameScreen() {
  const game = useApp((s) => s.game);
  const error = useApp((s) => s.error);
  const setError = useApp((s) => s.setError);
  const quitGame = useApp((s) => s.quitGame);
  const netRole = useApp((s) => s.netRole);
  const me = useMe();
  const actor = useActor();
  const canAct = useCanAct();

  const [deedTile, setDeedTile] = useState<number | null>(null);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pop, setPop] = useState<{ id: number; amount: number } | null>(null);
  const [bid, setBid] = useState(0);

  const moneyRef = useRef<number | null>(null);
  const logRef = useRef(0);

  /* Звук и всплывающая сумма при изменении баланса. */
  useEffect(() => {
    if (!game || !me) return;
    const prev = moneyRef.current;
    moneyRef.current = me.money;
    if (prev === null || prev === me.money) return;
    const delta = me.money - prev;
    setPop({ id: Date.now(), amount: delta });
    play(delta > 0 ? 'cash' : 'pay');
    haptic(delta > 0 ? 'success' : 'warning');
  }, [game, me]);

  useEffect(() => {
    if (!pop) return;
    const t = setTimeout(() => setPop(null), 1400);
    return () => clearTimeout(t);
  }, [pop]);

  /* Короткий звук на каждое новое событие в журнале. */
  useEffect(() => {
    if (!game) return;
    if (game.log.length === logRef.current) return;
    const grew = game.log.length > logRef.current;
    logRef.current = game.log.length;
    if (!grew) return;
    const emoji = game.log[0]?.emoji;
    if (emoji === '🏗️') play('build');
    else if (emoji === '🏷️') play('buy');
    else if (emoji === '🔨') play('gavel');
    else if (emoji === '🚔' || emoji === '🔒') play('jail');
  }, [game]);

  useEffect(() => {
    if (!error) return;
    play('error');
    const t = setTimeout(() => setError(null), 2600);
    return () => clearTimeout(t);
  }, [error, setError]);

  useEffect(() => {
    if (game?.auction) setBid(game.auction.bid + 20000);
  }, [game?.auction?.bid, game?.auction?.tile]);

  if (!game) {
    return (
      <Screen name="game">
        <div className="card center" style={{ padding: 30, marginTop: 40 }}>
          <div className="shimmer" style={{ fontSize: 36 }}>🎩</div>
          <div className="net-title" style={{ marginTop: 12 }}>Ждём партию</div>
          <p className="muted" style={{ marginTop: 6 }}>Хост ещё не прислал состояние.</p>
          <button className="btn block" style={{ marginTop: 18 }} onClick={() => { tap(); quitGame(); }}>
            На главный экран
          </button>
        </div>
      </Screen>
    );
  }

  const mode = getMode(game.settings.modeId);
  const send = (action: Action) => {
    if (!actor) return;
    tap('select');
    act(actor.id, action);
  };

  const prompt = game.prompt;
  const highlight = actor ? actor.pos : null;

  return (
    <Screen name="game" className="play">
      <div className="battle-top row" style={{ gap: 10 }}>
        <span style={{ fontSize: 22 }}>{actor?.emoji ?? '🎩'}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 760, fontSize: 15 }}>
            {canAct ? 'Ваш ход' : `Ходит ${actor?.name ?? '…'}`}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            {mode.emoji} круг {game.round}
            {game.settings.roundLimit > 0 ? ` из ${game.settings.roundLimit}` : ''} ·{' '}
            {money(actor?.money ?? 0)}
            {game.settings.parkingPot && game.pot > 0 ? ` · 🅿️ ${money(game.pot)}` : ''}
          </div>
        </div>
        <button className="icon-btn" onClick={() => { tap(); setMenuOpen(true); }} aria-label="Меню">
          ⋯
        </button>
      </div>

      <div className="play-body">
        <PlayerStrip state={game} meId={me?.id} onPick={() => setLogOpen(true)} />

        <Board state={game} highlight={highlight} onTile={(i) => { tap(); setDeedTile(i); }} />

        {error && <div className="notice warn">{error}</div>}

        {/* Торги идут поверх обычного хода. */}
        {game.stage === 'auction' && game.auction && (
          <div className="prompt-card">
            <div className="prompt-title">🔨 Торги: {tileAt(game.auction.tile).name}</div>
            <div className="prompt-text">
              Текущая ставка: <b>{game.auction.bid > 0 ? money(game.auction.bid) : 'нет'}</b>
              {game.auction.leaderId && ` · ${playerById(game, game.auction.leaderId)?.name}`}
              <br />
              Называет цену: <b>{playerById(game, game.auction.turnId)?.name}</b>
            </div>
            {canAct && (
              <>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn small" onClick={() => setBid((b) => Math.max(game.auction!.bid + 10000, b - 50000))}>
                    −50к
                  </button>
                  <div className="grow center mono" style={{ fontWeight: 800 }}>{money(bid)}</div>
                  <button className="btn small" onClick={() => setBid((b) => b + 50000)}>
                    +50к
                  </button>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn grow" onClick={() => send({ t: 'pass' })}>
                    Пас
                  </button>
                  <button className="btn primary grow" onClick={() => send({ t: 'bid', amount: bid })}>
                    Ставка
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Разбор клетки. */}
        {game.stage !== 'auction' && prompt.kind === 'buy' && (
          <div className="prompt-card">
            <div className="prompt-title">🏷️ {tileAt(prompt.tile).name}</div>
            <div className="prompt-text">
              Свободный участок за <b>{money(prompt.price)}</b>.{' '}
              {game.settings.auctions
                ? 'Откажетесь — участок уйдёт с торгов.'
                : 'Откажетесь — участок останется банку.'}
            </div>
            {canAct && (
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn grow" onClick={() => send({ t: 'decline' })}>
                  Отказаться
                </button>
                <button
                  className="btn primary grow"
                  disabled={(actor?.money ?? 0) < prompt.price}
                  onClick={() => send({ t: 'buy' })}
                >
                  Купить
                </button>
              </div>
            )}
          </div>
        )}

        {game.stage !== 'auction' && prompt.kind === 'rent' && (
          <div className="prompt-card">
            <div className="prompt-title">💸 Аренда</div>
            <div className="prompt-text">
              {tileAt(prompt.tile).name} принадлежит игроку{' '}
              <b>{playerById(game, prompt.toId)?.name}</b>. К оплате <b>{money(prompt.amount)}</b>.
            </div>
            {canAct && (
              <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => send({ t: 'ack' })}>
                Заплатить
              </button>
            )}
          </div>
        )}

        {game.stage !== 'auction' && prompt.kind === 'tax' && (
          <div className="prompt-card">
            <div className="prompt-title">🧾 {prompt.label}</div>
            <div className="prompt-text">К оплате <b>{money(prompt.amount)}</b>.</div>
            {canAct && (
              <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => send({ t: 'ack' })}>
                Заплатить
              </button>
            )}
          </div>
        )}

        {game.stage !== 'auction' && prompt.kind === 'card' && (
          <motion.div
            className="chance-card"
            initial={{ rotateX: -70, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
          >
            <div className="chance-emoji">{prompt.emoji}</div>
            <div className="chance-kind">{prompt.deck === 'chance' ? 'Шанс' : 'Общественная казна'}</div>
            <div className="chance-text">{prompt.text}</div>
            {canAct && (
              <button className="btn primary block" style={{ marginTop: 14 }} onClick={() => send({ t: 'ack' })}>
                Принять
              </button>
            )}
          </motion.div>
        )}

        {game.stage !== 'auction' && prompt.kind === 'jail' && (
          <div className="prompt-card">
            <div className="prompt-title">🔒 Вы в тюрьме</div>
            <div className="prompt-text">
              Отсидели {actor?.jailTurns ?? 0} из 3 ходов. Можно внести залог {money(JAIL_FEE)},
              использовать карточку освобождения или попробовать выбросить дубль.
            </div>
            {canAct && (
              <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn grow" onClick={() => send({ t: 'jailRoll' })}>
                  🎲 На дубль
                </button>
                <button
                  className="btn grow"
                  disabled={(actor?.money ?? 0) < JAIL_FEE}
                  onClick={() => send({ t: 'jailPay' })}
                >
                  Залог
                </button>
                {(actor?.jailCards ?? 0) > 0 && (
                  <button className="btn primary grow" onClick={() => send({ t: 'jailCard' })}>
                    🔑 Карточка
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {game.stage === 'debt' && prompt.kind === 'debt' && (
          <div className="prompt-card" style={{ borderColor: 'var(--danger)' }}>
            <div className="prompt-title">⚠️ Не хватает денег</div>
            <div className="prompt-text">
              Нужно <b>{money(prompt.amount)}</b>, а на руках {money(actor?.money ?? 0)}. Продайте
              постройки или заложите участки — платёж пройдёт сам, как только денег хватит.
            </div>
            {canAct && (
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn grow" onClick={() => { tap(); setAssetsOpen(true); }}>
                  Мои активы
                </button>
                <button className="btn danger grow" onClick={() => send({ t: 'bankrupt' })}>
                  Банкротство
                </button>
              </div>
            )}
          </div>
        )}

        <div className="wrap" style={{ justifyContent: 'center' }}>
          <button className="chip" onClick={() => { tap(); setAssetsOpen(true); }}>
            🏘️ Активы
          </button>
          <button className="chip" onClick={() => { tap(); setTradeOpen(true); }}>
            🤝 Обмен
          </button>
          <button className="chip" onClick={() => { tap(); setLogOpen(true); }}>
            📜 Журнал
          </button>
        </div>
      </div>

      {/* Нижняя панель хода. */}
      {canAct && game.stage !== 'auction' && (
        <div className="action-bar">
          {game.stage === 'roll' && (
            <button
              className="btn primary block"
              onClick={() => {
                play('dice');
                haptic('medium');
                send({ t: 'roll' });
              }}
            >
              🎲 Бросить кубики
            </button>
          )}
          {game.stage === 'end' && (
            <button className="btn primary block" onClick={() => send({ t: 'endTurn' })}>
              Завершить ход →
            </button>
          )}
        </div>
      )}

      {!canAct && game.stage !== 'auction' && (
        <div className="waiting-hint">
          {actor?.isBot ? `${actor.name} думает…` : `Ждём ход игрока ${actor?.name ?? '…'}`}
        </div>
      )}

      <AnimatePresence>
        {pop && (
          <motion.div
            key={pop.id}
            className={`money-pop ${pop.amount > 0 ? 'plus' : 'minus'}`}
            initial={{ opacity: 0, y: 20, scale: 0.85 }}
            animate={{ opacity: 1, y: -30, scale: 1 }}
            exit={{ opacity: 0, y: -60 }}
          >
            {moneyDelta(pop.amount)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Карточка участка. */}
      <Sheet open={deedTile !== null} onClose={() => setDeedTile(null)} title="Участок">
        {deedTile !== null && (
          <div className="stack">
            <DeedCard state={game} tileIndex={deedTile} />
            {groupProgress(game, deedTile) && (
              <div className="notice">{groupProgress(game, deedTile)}</div>
            )}
          </div>
        )}
      </Sheet>

      <AssetsSheet
        open={assetsOpen}
        onClose={() => setAssetsOpen(false)}
        onAction={(a) => send(a)}
      />

      <TradeSheet open={tradeOpen} onClose={() => setTradeOpen(false)} />

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Журнал партии">
        <div className="stack">
          {game.log.length === 0 && <div className="muted">Пока ничего не произошло.</div>}
          {game.log.map((entry, i) => (
            <div key={i} className="log-line">
              <span>{entry.emoji ?? '•'}</span>
              <span>{entry.text}</span>
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={`${mode.emoji} ${mode.name}`}>
        <div className="stack">
          <div className="card">
            <span className="label">Партия</span>
            <div className="wrap" style={{ marginTop: 10 }}>
              <span className="chip">👥 {game.players.filter((p) => !p.bankrupt).length} в игре</span>
              <span className="chip">🔁 круг {game.round}</span>
              {me && <span className="chip">💼 капитал {money(netWorth(game, me.id))}</span>}
            </div>
          </div>
          {netRole !== 'client' && (
            <button className="btn danger block" onClick={() => { setMenuOpen(false); quitGame(); }}>
              Завершить партию
            </button>
          )}
        </div>
      </Sheet>
    </Screen>
  );
}

/* ─────────────────────── управление имуществом ─────────────────────── */

function AssetsSheet({
  open,
  onClose,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  onAction: (a: Action) => void;
}) {
  const game = useApp((s) => s.game);
  const actor = useActor();
  const canAct = useCanAct();
  if (!game || !actor) return null;

  const tiles = ownedTiles(game, actor.id).sort((a, b) => a - b);

  return (
    <Sheet open={open} onClose={onClose} title="Мои активы">
      <div className="stack">
        <div className="card row between">
          <span className="label">Наличные</span>
          <b className="mono" style={{ color: 'var(--gold)' }}>{money(actor.money)}</b>
        </div>

        {game.settings.tycoon && (
          <div className="card stack">
            <div className="row between">
              <span className="label">Банковский кредит</span>
              <b className="mono">{money(actor.loan)}</b>
            </div>
            <div className="row">
              <button
                className="btn grow small"
                disabled={!canAct}
                onClick={() => onAction({ t: 'loan', amount: 200000 })}
              >
                Взять 200к
              </button>
              <button
                className="btn grow small"
                disabled={!canAct || actor.loan === 0}
                onClick={() => onAction({ t: 'repay', amount: actor.loan })}
              >
                Погасить
              </button>
            </div>
          </div>
        )}

        {tiles.length === 0 && <div className="muted">Пока ни одного участка.</div>}

        {tiles.map((i) => {
          const tile = tileAt(i);
          const prop = game.properties[i];
          const buildErr = canBuild(game, actor.id, i);
          const mortErr = canMortgage(game, actor.id, i);

          return (
            <div key={i} className="card stack" style={{ padding: 12 }}>
              <div className="row between">
                <b style={{ fontSize: 14 }}>{tile.name}</b>
                <span className="chip">
                  {prop.mortgaged
                    ? 'заложен'
                    : prop.houses >= 6
                      ? '🏙️ небоскрёб'
                      : prop.houses === 5
                        ? '🏨 отель'
                        : `${prop.houses} 🏠`}
                </span>
              </div>

              <div className="row" style={{ flexWrap: 'wrap' }}>
                {tile.kind === 'street' && (
                  <button
                    className="btn small grow"
                    disabled={!canAct || !!buildErr}
                    title={buildErr ?? ''}
                    onClick={() => onAction({ t: 'build', tile: i })}
                  >
                    🏗️ Строить {money(buildCost(game, i))}
                  </button>
                )}
                {prop.houses > 0 && (
                  <button
                    className="btn small grow"
                    disabled={!canAct}
                    onClick={() => onAction({ t: 'sellHouse', tile: i })}
                  >
                    Продать постройку
                  </button>
                )}
                {game.settings.mortgages && !prop.mortgaged && (
                  <button
                    className="btn small grow"
                    disabled={!canAct || !!mortErr}
                    title={mortErr ?? ''}
                    onClick={() => onAction({ t: 'mortgage', tile: i })}
                  >
                    🏦 Заложить
                  </button>
                )}
                {prop.mortgaged && (
                  <button
                    className="btn small grow"
                    disabled={!canAct}
                    onClick={() => onAction({ t: 'unmortgage', tile: i })}
                  >
                    Выкупить
                  </button>
                )}
              </div>

              {buildErr && tile.kind === 'street' && (
                <div className="setting-hint">{buildErr}</div>
              )}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

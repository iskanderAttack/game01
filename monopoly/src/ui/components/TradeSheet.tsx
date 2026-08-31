import { useEffect, useMemo, useState } from 'react';
import { useApp, useMe } from '../../store/appStore';
import { ownedTiles, tileAt } from '../../game/engine';
import { money } from '../../game/money';
import { act } from '../../net/bridge';
import { Sheet } from './Shell';
import { tap } from '../../lib/feedback';

const STEP = 50000;

/** Обмен участками и деньгами между игроками. */
export function TradeSheet({
  open,
  onClose,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  /** С кем и о чём торговаться — приходит из матрицы «кто чем владеет». */
  preset?: { partnerId: string; takeTiles: number[] } | null;
}) {
  const game = useApp((s) => s.game);
  const me = useMe();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [give, setGive] = useState<number[]>([]);
  const [take, setTake] = useState<number[]>([]);
  const [giveMoney, setGiveMoney] = useState(0);
  const [takeMoney, setTakeMoney] = useState(0);

  const partners = useMemo(
    () => (game && me ? game.players.filter((p) => !p.bankrupt && p.id !== me.id) : []),
    [game, me],
  );

  /* Пришли из матрицы владения — сразу подставляем собеседника и его клетки. */
  useEffect(() => {
    if (!open || !preset) return;
    setPartnerId(preset.partnerId);
    setTake(preset.takeTiles);
    setGive([]);
    setGiveMoney(0);
    setTakeMoney(0);
  }, [open, preset]);

  const incoming = useMemo(
    () => (game && me ? game.trades.filter((t) => t.toId === me.id) : []),
    [game, me],
  );

  if (!game || !me) return null;

  const partner = partners.find((p) => p.id === partnerId) ?? null;
  const myTiles = ownedTiles(game, me.id).sort((a, b) => a - b);
  const theirTiles = partner ? ownedTiles(game, partner.id).sort((a, b) => a - b) : [];

  const toggle = (list: number[], setList: (v: number[]) => void, tile: number) => {
    tap();
    setList(list.includes(tile) ? list.filter((t) => t !== tile) : [...list, tile]);
  };

  const reset = () => {
    setGive([]);
    setTake([]);
    setGiveMoney(0);
    setTakeMoney(0);
  };

  const propose = () => {
    if (!partner) return;
    tap('select');
    act(me.id, {
      t: 'trade',
      offer: {
        fromId: me.id,
        toId: partner.id,
        giveTiles: give,
        takeTiles: take,
        giveMoney,
        takeMoney,
        giveJailCards: 0,
        takeJailCards: 0,
      },
    });
    reset();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Обмен">
      <div className="stack">
        {incoming.length > 0 && (
          <>
            <span className="label">Вам предлагают</span>
            {incoming.map((offer) => {
              const from = game.players.find((p) => p.id === offer.fromId);
              return (
                <div key={offer.id} className="card stack" style={{ padding: 12 }}>
                  <b style={{ fontSize: 14 }}>
                    {from?.emoji} {from?.name}
                  </b>
                  <div className="setting-hint">
                    Отдаёт: {offer.giveTiles.map((i) => tileAt(i).short).join(', ') || '—'}
                    {offer.giveMoney > 0 && ` + ${money(offer.giveMoney)}`}
                  </div>
                  <div className="setting-hint">
                    Просит: {offer.takeTiles.map((i) => tileAt(i).short).join(', ') || '—'}
                    {offer.takeMoney > 0 && ` + ${money(offer.takeMoney)}`}
                  </div>
                  <div className="row">
                    <button
                      className="btn small grow"
                      onClick={() => {
                        tap();
                        act(me.id, { t: 'tradeRespond', id: offer.id, accept: false });
                      }}
                    >
                      Отклонить
                    </button>
                    <button
                      className="btn primary small grow"
                      onClick={() => {
                        tap('select');
                        act(me.id, { t: 'tradeRespond', id: offer.id, accept: true });
                      }}
                    >
                      Принять
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="divider" />
          </>
        )}

        <span className="label">С кем меняемся</span>
        <div className="wrap">
          {partners.map((p) => (
            <button
              key={p.id}
              className={`chip ${partnerId === p.id ? 'on' : ''}`}
              onClick={() => {
                tap();
                setPartnerId(p.id);
                setTake([]);
              }}
            >
              {p.emoji} {p.name}
            </button>
          ))}
        </div>

        {partner && (
          <>
            <span className="label">Вы отдаёте</span>
            <div className="wrap">
              {myTiles.length === 0 && <span className="muted">Участков нет</span>}
              {myTiles.map((i) => (
                <button
                  key={i}
                  className={`chip ${give.includes(i) ? 'on' : ''}`}
                  onClick={() => toggle(give, setGive, i)}
                >
                  {tileAt(i).short}
                </button>
              ))}
            </div>
            <div className="row between">
              <span className="setting-hint">Доплата от вас</span>
              <div className="row">
                <button className="btn small" onClick={() => setGiveMoney((v) => Math.max(0, v - STEP))}>
                  −
                </button>
                <span className="mono" style={{ minWidth: 96, textAlign: 'center' }}>
                  {money(giveMoney)}
                </span>
                <button
                  className="btn small"
                  onClick={() => setGiveMoney((v) => Math.min(me.money, v + STEP))}
                >
                  +
                </button>
              </div>
            </div>

            <div className="divider" />

            <span className="label">Вы получаете</span>
            <div className="wrap">
              {theirTiles.length === 0 && <span className="muted">У партнёра нет участков</span>}
              {theirTiles.map((i) => (
                <button
                  key={i}
                  className={`chip ${take.includes(i) ? 'on' : ''}`}
                  onClick={() => toggle(take, setTake, i)}
                >
                  {tileAt(i).short}
                </button>
              ))}
            </div>
            <div className="row between">
              <span className="setting-hint">Доплата от партнёра</span>
              <div className="row">
                <button className="btn small" onClick={() => setTakeMoney((v) => Math.max(0, v - STEP))}>
                  −
                </button>
                <span className="mono" style={{ minWidth: 96, textAlign: 'center' }}>
                  {money(takeMoney)}
                </span>
                <button
                  className="btn small"
                  onClick={() => setTakeMoney((v) => Math.min(partner.money, v + STEP))}
                >
                  +
                </button>
              </div>
            </div>

            <button
              className="btn primary block"
              disabled={give.length + take.length === 0 && giveMoney + takeMoney === 0}
              onClick={propose}
            >
              Предложить обмен
            </button>
            <div className="setting-hint">
              Обмен можно предлагать в любой момент — партнёр увидит его на этом же экране.
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

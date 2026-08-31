import { useMemo, useState } from 'react';
import { useApp, useMe } from '../../store/appStore';
import { act } from '../../net/bridge';
import { money, moneyShort } from '../../game/money';
import {
  COINS,
  COUNTRIES,
  MONTHS,
  SECTORS,
  STOCKS,
  bondPrice,
  changeOf,
  demandRate,
  nameOf,
  ofzCoupon,
  realtyPrice,
  seasonOf,
  sectorOf,
  termRate,
  type MarketState,
  type Portfolio,
  type SectorId,
} from '../../game/market';
import { CORP_PREMIUM } from '../../game/market';
import { STARTUP_MIN, oddsFor } from '../../game/startups';
import { getEvent } from '../../game/events';
import type { FinOp } from '../../game/finance';
import { Sheet } from './Shell';
import { tap } from '../../lib/feedback';

/**
 * Рынок режима «Империя».
 *
 * Открыт в любой момент, в том числе в чужой ход: цены меняются ровно раз
 * в игровой месяц, поэтому одновременные сделки честны и никто не выигрывает
 * от того, что нажал раньше.
 */

type Tab = 'news' | 'stocks' | 'crypto' | 'bonds' | 'bank' | 'realty' | 'startups';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'news', label: '📰 Новости' },
  { id: 'stocks', label: '📈 Акции' },
  { id: 'crypto', label: '₿ Крипта' },
  { id: 'bonds', label: '📜 Облигации' },
  { id: 'bank', label: '🏦 Вклад' },
  { id: 'realty', label: '🌍 Недвижимость' },
  { id: 'startups', label: '🚀 Стартапы' },
];

export function MarketSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const game = useApp((s) => s.game);
  const me = useMe();
  const [tab, setTab] = useState<Tab>('news');

  const market = game?.market ?? null;
  if (!market || !me) return null;

  const send = (op: FinOp) => {
    tap('select');
    act(me.id, { t: 'fin', op });
  };

  return (
    <Sheet open={open} onClose={onClose} title="💹 Рынок">
      <div className="stack">
        <MarketHeader market={market} portfolio={me.portfolio} cash={me.money} />

        <div className="wrap market-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`chip ${tab === t.id ? 'on' : ''}`}
              onClick={() => {
                tap();
                setTab(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'news' && <NewsTab market={market} portfolio={me.portfolio} />}
        {tab === 'stocks' && <StocksTab market={market} p={me.portfolio} cash={me.money} send={send} />}
        {tab === 'crypto' && <CryptoTab market={market} p={me.portfolio} cash={me.money} send={send} />}
        {tab === 'bonds' && <BondsTab market={market} p={me.portfolio} cash={me.money} send={send} />}
        {tab === 'bank' && <BankTab market={market} p={me.portfolio} cash={me.money} send={send} />}
        {tab === 'realty' && <RealtyTab market={market} p={me.portfolio} cash={me.money} send={send} />}
        {tab === 'startups' && <StartupsTab market={market} p={me.portfolio} cash={me.money} send={send} />}
      </div>
    </Sheet>
  );
}

/* ───────────────────────────── шапка ───────────────────────────── */

function MarketHeader({
  market,
  portfolio,
  cash,
}: {
  market: MarketState;
  portfolio: Portfolio;
  cash: number;
}) {
  const season = seasonOf(market.month);
  const value = useMemo(() => portfolioTotal(market, portfolio), [market, portfolio]);

  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row between">
        <span style={{ fontWeight: 740 }}>
          {season.emoji} {MONTHS[market.month - 1]}, год {market.year}
        </span>
        <span className="chip">🏛️ ставка {fmtRate(market.keyRate)} %</span>
      </div>
      <div className="wrap">
        <span className="chip">💵 наличные {moneyShort(cash)}</span>
        <span className="chip">💼 на рынке {moneyShort(value)}</span>
        <span className="chip">🏦 вклад под {fmtRate(termRate(market.keyRate))} %</span>
      </div>
    </div>
  );
}

/* ───────────────────────────── новости ───────────────────────────── */

function NewsTab({ market, portfolio }: { market: MarketState; portfolio: Portfolio }) {
  return (
    <div className="stack">
      {market.news.length === 0 && (
        <div className="muted">Первая новость выйдет, когда все пройдут круг.</div>
      )}
      {market.news.map((id, i) => {
        const event = getEvent(id);
        const active = market.events.find((a) => a.id === id);
        return (
          <div key={`${id}-${i}`} className={`news-card ${i === 0 ? 'fresh' : ''}`}>
            <span className="news-emoji">{event.emoji}</span>
            <div style={{ minWidth: 0 }}>
              <div className="news-title">{event.title}</div>
              <div className="news-text">{event.text}</div>
              <div className="news-meta">
                {event.rate !== 0 && (
                  <span className={event.rate > 0 ? 'up' : 'down'}>
                    ставка {event.rate > 0 ? '↑' : '↓'} {Math.abs(event.rate)} п.п.
                  </span>
                )}
                {Object.entries(event.sectors).map(([s, v]) => (
                  <span key={s} className={(v ?? 0) > 0 ? 'up' : 'down'}>
                    {sectorOf(s as SectorId).emoji} {(v ?? 0) > 0 ? '+' : ''}
                    {Math.round((v ?? 0) * 100)} %
                  </span>
                ))}
                {active && <span className="muted">ещё {active.left} мес.</span>}
              </div>
            </div>
          </div>
        );
      })}

      <PortfolioSummary market={market} p={portfolio} />
    </div>
  );
}

function PortfolioSummary({ market, p }: { market: MarketState; p: Portfolio }) {
  const rows: Array<[string, number]> = [
    ['📈 Бумаги и монеты', Object.entries(p.positions).reduce((s, [id, h]) => s + (market.prices[id] ?? 0) * h.qty, 0)],
    ['📜 Облигации', p.bonds.reduce((s, b) => s + bondPrice(b.coupon, market.keyRate) * b.qty, 0)],
    ['🏦 Вклады', p.term + p.demand],
    ['🌍 Недвижимость', Object.entries(p.realty).reduce((s, [c, n]) => s + realtyPrice(market, c) * n, 0)],
    ['🚀 Стартапы', p.startups.filter((s) => s.state === 'alive').reduce((s, x) => s + Math.round(x.valuation * 0.5), 0)],
  ];
  const total = rows.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;

  return (
    <div className="card stack" style={{ gap: 8 }}>
      <span className="label">Что у вас на рынке</span>
      {rows
        .filter(([, v]) => v > 0)
        .map(([name, v]) => (
          <div key={name} className="row between" style={{ fontSize: 13 }}>
            <span>{name}</span>
            <b className="mono">{money(v)}</b>
          </div>
        ))}
      <div className="divider" />
      <div className="row between">
        <b>Итого</b>
        <b className="mono" style={{ color: 'var(--gold)' }}>{money(total)}</b>
      </div>
    </div>
  );
}

/* ───────────────────────────── акции и крипта ───────────────────────────── */

function TradeRow({
  id,
  title,
  subtitle,
  price,
  change,
  held,
  avg,
  cash,
  send,
  spark,
}: {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  change: number;
  held: number;
  avg: number;
  cash: number;
  send: (op: FinOp) => void;
  spark: number[];
}) {
  const [open, setOpen] = useState(false);
  const affordable = Math.floor(cash / Math.max(1, price * 1.01));

  return (
    <div className={`quote ${open ? 'open' : ''}`}>
      <button
        className="quote-head"
        onClick={() => {
          tap();
          setOpen((v) => !v);
        }}
      >
        <div style={{ minWidth: 0, textAlign: 'left' }}>
          <div className="quote-name">{title}</div>
          <div className="quote-sub">{subtitle}</div>
        </div>
        <Spark values={spark} up={change >= 0} />
        <div style={{ textAlign: 'right' }}>
          <div className="mono quote-price">{moneyShort(price)}</div>
          <div className={`quote-change ${change >= 0 ? 'up' : 'down'}`}>
            {change >= 0 ? '+' : ''}
            {(change * 100).toFixed(1)} %
          </div>
        </div>
      </button>

      {held > 0 && (
        <div className="quote-held">
          у вас {held} шт · вложено {moneyShort(avg * held)} ·{' '}
          <span className={price >= avg ? 'up' : 'down'}>
            {price >= avg ? '+' : '−'}
            {moneyShort(Math.abs((price - avg) * held))}
          </span>
        </div>
      )}

      {open && (
        <div className="quote-actions">
          {[1, 5, 25].map((n) => (
            <button
              key={n}
              className="btn small"
              disabled={affordable < n}
              onClick={() => send({ op: 'buy', id, qty: n })}
            >
              +{n}
            </button>
          ))}
          <button
            className="btn small"
            disabled={affordable < 1}
            onClick={() => send({ op: 'buy', id, qty: affordable })}
          >
            На всё
          </button>
          {held > 0 && (
            <button className="btn small danger" onClick={() => send({ op: 'sell', id, qty: held })}>
              Продать всё
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StocksTab({
  market,
  p,
  cash,
  send,
}: {
  market: MarketState;
  p: Portfolio;
  cash: number;
  send: (op: FinOp) => void;
}) {
  return (
    <div className="stack">
      {SECTORS.map((sector) => {
        const own = STOCKS.filter((s) => s.sector === sector.id);
        const ipo = market.ipo.filter((s) => s.sector === sector.id);
        return (
          <div key={sector.id} className="stack" style={{ gap: 6 }}>
            <span className="label">
              {sector.emoji} {sector.name}
            </span>
            {[...own.map((s) => s.id), ...ipo.map((s) => s.id)].map((id) => {
              const pos = p.positions[id];
              return (
                <TradeRow
                  key={id}
                  id={id}
                  title={nameOf(id, market)}
                  subtitle={id}
                  price={market.prices[id] ?? 0}
                  change={changeOf(market, id)}
                  held={pos?.qty ?? 0}
                  avg={pos?.avg ?? 0}
                  cash={cash}
                  send={send}
                  spark={market.history[id] ?? []}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function CryptoTab({
  market,
  p,
  cash,
  send,
}: {
  market: MarketState;
  p: Portfolio;
  cash: number;
  send: (op: FinOp) => void;
}) {
  return (
    <div className="stack">
      <div className="notice">
        Крупные монеты качает сильно, мелкие токены — вчетверо сильнее, и они
        могут обнулиться за месяц. Зато иногда дают пятикратный рост.
      </div>
      {COINS.map((c) => {
        const pos = p.positions[c.id];
        return (
          <TradeRow
            key={c.id}
            id={c.id}
            title={`${c.emoji} ${c.name}`}
            subtitle={c.major ? 'крупная монета' : 'малоизвестный токен'}
            price={market.prices[c.id] ?? 0}
            change={changeOf(market, c.id)}
            held={pos?.qty ?? 0}
            avg={pos?.avg ?? 0}
            cash={cash}
            send={send}
            spark={market.history[c.id] ?? []}
          />
        );
      })}
    </div>
  );
}

/* ───────────────────────────── облигации ───────────────────────────── */

function BondsTab({
  market,
  p,
  cash,
  send,
}: {
  market: MarketState;
  p: Portfolio;
  cash: number;
  send: (op: FinOp) => void;
}) {
  const ofz = ofzCoupon(market.keyRate);
  const corp = ofz + CORP_PREMIUM;

  return (
    <div className="stack">
      <div className="notice">
        Купон фиксируется в момент покупки. Если ставка потом упадёт, тело
        облигации подорожает — на этом и зарабатывают.
      </div>

      {[
        { kind: 'ofz' as const, name: 'ОФЗ', note: 'государственные, без дефолта', coupon: ofz },
        { kind: 'corp' as const, name: 'Корпоративные', note: 'купон выше, но бывает дефолт', coupon: corp },
      ].map((b) => {
        const price = bondPrice(b.coupon, market.keyRate);
        return (
          <div key={b.kind} className="card stack" style={{ gap: 8 }}>
            <div className="row between">
              <div>
                <div style={{ fontWeight: 740 }}>{b.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{b.note}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontWeight: 800, color: 'var(--gold)' }}>
                  {fmtRate(b.coupon)} %
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{moneyShort(price)} за штуку</div>
              </div>
            </div>
            <div className="row">
              {[1, 3, 10].map((n) => (
                <button
                  key={n}
                  className="btn small grow"
                  disabled={cash < price * n}
                  onClick={() => send({ op: 'buyBond', kind: b.kind, qty: n })}
                >
                  Купить {n}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {p.bonds.length > 0 && <span className="label">Ваши выпуски</span>}
      {p.bonds.map((b) => {
        const now = bondPrice(b.coupon, market.keyRate);
        return (
          <div key={b.id} className="card row between" style={{ padding: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                {b.kind === 'ofz' ? 'ОФЗ' : 'Корпоративные'} · {b.qty} шт
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                купон {fmtRate(b.coupon)} % · {moneyShort(now)} за штуку
              </div>
            </div>
            <button className="btn small" onClick={() => send({ op: 'sellBond', bondId: b.id })}>
              Продать
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── вклад ───────────────────────────── */

function BankTab({
  market,
  p,
  cash,
  send,
}: {
  market: MarketState;
  p: Portfolio;
  cash: number;
  send: (op: FinOp) => void;
}) {
  const rows = [
    {
      kind: 'term' as const,
      name: 'Срочный вклад',
      note: 'проценты капают каждый месяц на всю сумму вместе с уже начисленными',
      rate: termRate(market.keyRate),
      amount: p.term,
      warn: 'Досрочное снятие съедает проценты текущего месяца.',
    },
    {
      kind: 'demand' as const,
      name: 'До востребования',
      note: 'снимается свободно, но процент вдвое скромнее',
      rate: demandRate(market.keyRate),
      amount: p.demand,
      warn: '',
    },
  ];

  return (
    <div className="stack">
      <div className="notice">
        При ставке ЦБ {fmtRate(market.keyRate)} % вклад приносит{' '}
        {fmtRate(termRate(market.keyRate))} % годовых.{' '}
        {market.keyRate >= 12
          ? 'Сейчас деньгам выгоднее лежать в банке, чем в акциях.'
          : 'Ставка низкая — деньги стоит выводить в дело.'}
      </div>

      {rows.map((r) => (
        <div key={r.kind} className="card stack" style={{ gap: 8 }}>
          <div className="row between">
            <div>
              <div style={{ fontWeight: 740 }}>{r.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{r.note}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontWeight: 800, color: 'var(--gold)' }}>
                {fmtRate(r.rate)} %
              </div>
              <div className="muted" style={{ fontSize: 12 }}>{moneyShort(r.amount)}</div>
            </div>
          </div>
          <div className="row">
            {[0.25, 0.5, 1].map((share) => (
              <button
                key={share}
                className="btn small grow"
                disabled={cash < 1000}
                onClick={() => send({ op: 'deposit', kind: r.kind, amount: Math.floor(cash * share) })}
              >
                {share === 1 ? 'Всё' : `${share * 100} %`}
              </button>
            ))}
            <button
              className="btn small grow"
              disabled={r.amount <= 0}
              onClick={() => send({ op: 'withdraw', kind: r.kind, amount: r.amount })}
            >
              Снять
            </button>
          </div>
          {r.warn && r.amount > 0 && <div className="setting-hint">{r.warn}</div>}
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── зарубежка ───────────────────────────── */

function RealtyTab({
  market,
  p,
  cash,
  send,
}: {
  market: MarketState;
  p: Portfolio;
  cash: number;
  send: (op: FinOp) => void;
}) {
  return (
    <div className="stack">
      <div className="notice">
        Аренда капает каждый месяц. При покупке и продаже теряется 4 % на
        спреде — быстро перепродавать невыгодно.
      </div>
      {COUNTRIES.map((c) => {
        const price = realtyPrice(market, c.id);
        const owned = p.realty[c.id] ?? 0;
        const index = market.realty[c.id] ?? 1;
        return (
          <div key={c.id} className="card stack" style={{ gap: 8 }}>
            <div className="row between">
              <div>
                <div style={{ fontWeight: 740 }}>
                  {c.flag} {c.name}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  аренда {(c.yield * 100).toFixed(1)} % годовых ·{' '}
                  <span className={index >= 1 ? 'up' : 'down'}>
                    рынок {index >= 1 ? '+' : ''}
                    {Math.round((index - 1) * 100)} %
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontWeight: 800 }}>{moneyShort(price)}</div>
                {owned > 0 && <div className="muted" style={{ fontSize: 12 }}>у вас {owned}</div>}
              </div>
            </div>
            <div className="row">
              <button
                className="btn small grow"
                disabled={cash < price * 1.04}
                onClick={() => send({ op: 'buyRealty', country: c.id })}
              >
                Купить
              </button>
              <button
                className="btn small grow"
                disabled={owned === 0}
                onClick={() => send({ op: 'sellRealty', country: c.id })}
              >
                Продать
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── стартапы ───────────────────────────── */

function StartupsTab({
  market,
  p,
  cash,
  send,
}: {
  market: MarketState;
  p: Portfolio;
  cash: number;
  send: (op: FinOp) => void;
}) {
  const [sector, setSector] = useState<SectorId>('tech');
  const alive = p.startups.filter((s) => s.state === 'alive');

  return (
    <div className="stack">
      <div className="notice">
        Каждый месяц у стартапа считаются три исхода: закрыться, поднять раунд
        или выйти на биржу. Шансы зависят от новостей в секторе, ставки ЦБ и
        вложенных денег — и показаны честно.
      </div>

      <div className="card stack" style={{ gap: 8 }}>
        <span className="label">Основать компанию</span>
        <div className="wrap">
          {SECTORS.map((s) => (
            <button
              key={s.id}
              className={`chip ${sector === s.id ? 'on' : ''}`}
              onClick={() => {
                tap();
                setSector(s.id);
              }}
            >
              {s.emoji} {s.name}
            </button>
          ))}
        </div>
        <div className="row">
          {[STARTUP_MIN, 400000, 1000000].map((amount) => (
            <button
              key={amount}
              className="btn small grow"
              disabled={cash < amount || alive.length >= 3}
              onClick={() => send({ op: 'found', sector, amount })}
            >
              {moneyShort(amount)}
            </button>
          ))}
        </div>
        {alive.length >= 3 && (
          <div className="setting-hint">Больше трёх стартапов сразу не потянуть.</div>
        )}
      </div>

      {p.startups.map((s) => {
        const odds = oddsFor(market, s);
        return (
          <div key={s.id} className="card stack" style={{ gap: 8 }}>
            <div className="row between">
              <div>
                <div style={{ fontWeight: 740 }}>
                  {sectorOf(s.sector).emoji} {s.name}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {s.state === 'dead'
                    ? 'закрылся'
                    : s.state === 'public'
                      ? `вышел на биржу — ${s.ticker}`
                      : `раундов ${s.rounds} · ${s.months} мес. · вложено ${moneyShort(s.invested)}`}
                </div>
              </div>
              {s.state === 'alive' && (
                <div className="mono" style={{ fontWeight: 800, color: 'var(--gold)' }}>
                  {moneyShort(s.valuation)}
                </div>
              )}
            </div>

            {s.state === 'alive' && (
              <>
                <div className="odds">
                  <span className="down">закроется {(odds.die * 100).toFixed(0)} %</span>
                  <span className="up">раунд {(odds.round * 100).toFixed(0)} %</span>
                  <span className={odds.ipo > 0 ? 'up' : 'muted'}>
                    IPO {odds.ipo > 0 ? `${(odds.ipo * 100).toFixed(0)} %` : 'после трёх раундов'}
                  </span>
                </div>
                <div className="row">
                  <button
                    className="btn small grow"
                    disabled={cash < 200000}
                    onClick={() => send({ op: 'fund', startupId: s.id, amount: 200000 })}
                  >
                    Доложить 200к
                  </button>
                  <button
                    className="btn small grow"
                    onClick={() => send({ op: 'exit', startupId: s.id })}
                  >
                    Продать долю
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── мелочи ───────────────────────────── */

function Spark({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return <span className="spark" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 46},${18 - ((v - min) / span) * 16}`)
    .join(' ');

  return (
    <svg className="spark" viewBox="0 0 46 20" width="46" height="20" aria-hidden="true">
      <polyline points={points} fill="none" stroke={up ? '#34d399' : '#fb7185'} strokeWidth="1.6" />
    </svg>
  );
}

function portfolioTotal(market: MarketState, p: Portfolio): number {
  let sum = p.term + p.demand;
  for (const [id, h] of Object.entries(p.positions)) sum += (market.prices[id] ?? 0) * h.qty;
  for (const b of p.bonds) sum += bondPrice(b.coupon, market.keyRate) * b.qty;
  for (const [c, n] of Object.entries(p.realty)) sum += realtyPrice(market, c) * n;
  for (const s of p.startups) if (s.state === 'alive') sum += Math.round(s.valuation * 0.5);
  return Math.round(sum);
}

/** «9», «12,5» — без лишних нулей. */
function fmtRate(v: number): string {
  return v.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
}

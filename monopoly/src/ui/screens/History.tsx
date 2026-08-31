import { useMemo, useState } from 'react';
import { useApp } from '../../store/appStore';
import { summarize, useHistory, type HistoryEntry } from '../../store/historyStore';
import { getMode } from '../../game/modes';
import { money } from '../../game/money';
import { Screen, TopBar } from '../components/Shell';
import { tap } from '../../lib/feedback';

export function HistoryScreen() {
  const go = useApp((s) => s.go);
  const entries = useHistory((s) => s.entries);
  const clear = useHistory((s) => s.clear);
  const [confirmClear, setConfirmClear] = useState(false);

  const stats = useMemo(() => summarize(entries), [entries]);

  return (
    <Screen name="history">
      <TopBar title="История партий" onBack={() => go('home')} />

      <div className="scroll">
        {entries.length === 0 ? (
          <div className="card center" style={{ padding: 30 }}>
            <div style={{ fontSize: 36 }}>📜</div>
            <div className="net-title" style={{ marginTop: 12 }}>Пока пусто</div>
            <p className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>
              Сыграйте партию до конца — итоги сохранятся здесь сами.
            </p>
          </div>
        ) : (
          <>
            <div className="card stack">
              <span className="label">Ваш счёт</span>
              <div className="wrap">
                <span className="chip">🎲 партий {stats.games}</span>
                <span className="chip">🏆 побед {stats.wins}</span>
                {stats.games > 0 && (
                  <span className="chip">
                    📈 {Math.round((stats.wins / stats.games) * 100)}% побед
                  </span>
                )}
                {stats.best > 0 && <span className="chip">💼 рекорд {money(stats.best)}</span>}
                {stats.favouriteMode && (
                  <span className="chip">
                    {getMode(stats.favouriteMode).emoji} чаще всего{' '}
                    {getMode(stats.favouriteMode).name}
                  </span>
                )}
              </div>
            </div>

            {entries.map((entry) => (
              <HistoryCard key={entry.id} entry={entry} />
            ))}

            <button
              className={`btn block ${confirmClear ? 'danger' : ''}`}
              onClick={() => {
                tap();
                if (confirmClear) {
                  clear();
                  setConfirmClear(false);
                } else {
                  setConfirmClear(true);
                }
              }}
            >
              {confirmClear ? 'Точно стереть всю историю?' : 'Очистить историю'}
            </button>
          </>
        )}
      </div>
    </Screen>
  );
}

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const [open, setOpen] = useState(false);
  const mode = getMode(entry.modeId);
  const winner = entry.players.find((p) => p.won);
  const me = entry.players.find((p) => p.isMe);
  const date = new Date(entry.at);

  return (
    <div className="card stack" style={{ padding: 14 }}>
      <button
        className="row between"
        style={{ background: 'none', border: 0, padding: 0, width: '100%', color: 'inherit' }}
        onClick={() => {
          tap();
          setOpen((v) => !v);
        }}
      >
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 22 }}>{me?.won ? '🏆' : mode.emoji}</span>
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>
              {mode.name} · {entry.players.length} игрока
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {date.toLocaleDateString('ru-RU')} · круги: {entry.rounds} ·{' '}
              {winner ? `победа: ${winner.name}` : 'без победителя'}
            </div>
          </div>
        </div>
        <span className="muted">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="stack" style={{ gap: 6 }}>
          {entry.players.map((p) => (
            <div
              key={`${p.place}-${p.name}`}
              className="row between"
              style={{
                padding: '7px 10px',
                borderRadius: 12,
                background: p.isMe ? 'rgba(212, 162, 76, 0.14)' : 'transparent',
              }}
            >
              <span className="row" style={{ gap: 8, minWidth: 0 }}>
                <b className="mono" style={{ opacity: 0.5, width: 16 }}>{p.place}</b>
                <span>{p.emoji}</span>
                <span style={{ fontWeight: p.isMe ? 700 : 500 }}>{p.name}</span>
                {p.isBot && <span className="muted" style={{ fontSize: 11 }}>бот</span>}
              </span>
              <b className="mono" style={{ fontSize: 13 }}>{money(p.netWorth)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

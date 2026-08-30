import { useEffect } from 'react';
import { useApp, useMe } from '../../store/appStore';
import { netWorth, ranking } from '../../game/engine';
import { getMode } from '../../game/modes';
import { money } from '../../game/money';
import { Screen, TopBar } from '../components/Shell';
import { ScoreRow } from '../components/PlayerBits';
import { Confetti } from '../components/Confetti';
import { play, tap } from '../../lib/feedback';

export function ResultsScreen() {
  const game = useApp((s) => s.game);
  const netRole = useApp((s) => s.netRole);
  const quitGame = useApp((s) => s.quitGame);
  const startGame = useApp((s) => s.startGame);
  const go = useApp((s) => s.go);
  const me = useMe();

  const iWon = !!game && !!me && game.winnerIds.includes(me.id);

  useEffect(() => {
    play(iWon ? 'win' : 'lose');
  }, [iWon]);

  if (!game) {
    return (
      <Screen name="results">
        <div className="card center" style={{ padding: 30, marginTop: 40 }}>
          <div className="muted">Партия не найдена.</div>
          <button className="btn block" style={{ marginTop: 16 }} onClick={() => go('home')}>
            На главный экран
          </button>
        </div>
      </Screen>
    );
  }

  const mode = getMode(game.settings.modeId);
  const table = ranking(game);
  const winners = game.players.filter((p) => game.winnerIds.includes(p.id));

  return (
    <Screen name="results">
      {iWon && <Confetti />}
      <TopBar title="Итоги партии" subtitle={`${mode.emoji} ${mode.name}`} />

      <div className="scroll">
        <div className="result-hero">
          <div className="result-emoji">{iWon ? '🏆' : winners.length ? '🎩' : '🎲'}</div>
          <div className="result-title">
            {iWon
              ? 'Победа!'
              : winners.length
                ? `Победа: ${winners.map((w) => w.name).join(', ')}`
                : 'Партия окончена'}
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            {game.settings.roundLimit > 0
              ? `Круги закончились — победил самый крупный капитал.`
              : 'Остальные разорились.'}
          </p>
        </div>

        <div className="card" style={{ padding: 8 }}>
          {table.map((p, i) => (
            <ScoreRow key={p.id} state={game} player={p} place={i + 1} highlight={p.id === me?.id} />
          ))}
        </div>

        {me && (
          <div className="card stack">
            <span className="label">Ваша партия</span>
            <div className="wrap">
              <span className="chip">💼 капитал {money(netWorth(game, me.id))}</span>
              <span className="chip">🎲 бросков {me.stats.rolls}</span>
              <span className="chip">🏷️ куплено {me.stats.bought}</span>
              <span className="chip">💰 получено аренды {money(me.stats.rentEarned)}</span>
              <span className="chip">💸 уплачено {money(me.stats.rentPaid)}</span>
              {me.stats.jailVisits > 0 && <span className="chip">🔒 в тюрьме {me.stats.jailVisits} раз</span>}
            </div>
          </div>
        )}
      </div>

      {netRole === 'local' ? (
        <div className="row">
          <button className="btn grow" onClick={() => { tap(); quitGame(); }}>
            В меню
          </button>
          <button className="btn primary grow" onClick={() => { tap('select'); startGame(); }}>
            Ещё партия
          </button>
        </div>
      ) : (
        <button
          className="btn primary block"
          onClick={() => {
            tap();
            quitGame();
            go('home');
          }}
        >
          В меню
        </button>
      )}
    </Screen>
  );
}

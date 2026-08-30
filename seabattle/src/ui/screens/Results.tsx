import { useEffect } from 'react';
import { useApp, useCurrentView } from '../../store/appStore';
import { ranking } from '../../game/engine';
import { getMode } from '../../game/modes';
import { Screen, TopBar } from '../components/Shell';
import { ScoreRow } from '../components/PlayerBits';
import { Confetti } from '../components/Confetti';
import { play, tap } from '../../lib/feedback';

export function ResultsScreen() {
  const game = useApp((s) => s.game);
  const view = useCurrentView();
  const netRole = useApp((s) => s.netRole);
  const huntRecord = useApp((s) => s.huntRecord);
  const quitGame = useApp((s) => s.quitGame);
  const startGame = useApp((s) => s.startGame);
  const go = useApp((s) => s.go);

  const winnerIds = view?.winnerIds ?? game?.winnerIds ?? [];
  const meId = view?.me.id ?? null;
  const iWon = !!meId && winnerIds.includes(meId);

  useEffect(() => {
    play(iWon ? 'win' : 'lose');
  }, [iWon]);

  const mode = getMode(view?.settings.modeId ?? game?.settings.modeId ?? 'classic');

  // Полная таблица есть только у хозяина партии; клиент видит себя и соперников.
  const players = game
    ? ranking(game.players)
    : view
      ? ranking([
          view.me,
          ...view.allies,
        ])
      : [];

  const winnerNames = game
    ? game.players.filter((p) => winnerIds.includes(p.id)).map((p) => p.name)
    : iWon
      ? [view?.me.name ?? '']
      : [];

  return (
    <Screen name="results" className="results">
      {iWon && <Confetti />}
      <TopBar title="Итоги боя" subtitle={`${mode.emoji} ${mode.name}`} />

      <div className="scroll">
        <div className="result-hero">
          <div className="result-emoji">{iWon ? '🏆' : winnerNames.length ? '🎖️' : '⚓'}</div>
          <div className="result-title">
            {iWon ? 'Победа!' : winnerNames.length ? `Победа: ${winnerNames.join(', ')}` : 'Бой окончен'}
          </div>
          {mode.id === 'hunt' && view && (
            <p className="muted" style={{ marginTop: 10 }}>
              Выстрелов потрачено: <b>{view.me.stats.shots}</b>
              {huntRecord !== null && ` · ваш рекорд: ${huntRecord}`}
            </p>
          )}
        </div>

        {players.length > 0 && (
          <div className="card" style={{ padding: 8 }}>
            {players.map((p, i) => (
              <ScoreRow key={p.id} player={p} place={i + 1} highlight={p.id === meId} />
            ))}
          </div>
        )}

        {view && (
          <div className="card stack">
            <span className="label">Ваша статистика</span>
            <div className="wrap">
              <span className="chip">🎯 выстрелов {view.me.stats.shots}</span>
              <span className="chip">💥 попаданий {view.me.stats.hits}</span>
              <span className="chip">🚢 потоплено {view.me.stats.sunk}</span>
              <span className="chip">
                📊 точность{' '}
                {view.me.stats.shots ? Math.round((view.me.stats.hits / view.me.stats.shots) * 100) : 0}%
              </span>
              {view.me.stats.abilities > 0 && <span className="chip">🎖️ способностей {view.me.stats.abilities}</span>}
            </div>
          </div>
        )}
      </div>

      {netRole === 'local' ? (
        <div className="row">
          <button
            className="btn grow"
            onClick={() => {
              tap();
              quitGame();
            }}
          >
            В меню
          </button>
          <button
            className="btn primary grow"
            onClick={() => {
              tap('select');
              startGame();
            }}
          >
            Ещё бой
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

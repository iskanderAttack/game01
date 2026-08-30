import { useApp } from '../../store/appStore';
import { GAME_MODES } from '../../game/modes';
import { Screen, TopBar } from '../components/Shell';
import { tap } from '../../lib/feedback';

export function ModesScreen() {
  const go = useApp((s) => s.go);
  const setMode = useApp((s) => s.setMode);
  const settings = useApp((s) => s.settings);

  return (
    <Screen name="modes">
      <TopBar title="Режимы" subtitle="Выберите, как будете воевать" onBack={() => go('home')} />

      <div className="scroll">
        {GAME_MODES.map((m) => (
          <button
            key={m.id}
            className={`mode-card ${settings.modeId === m.id ? 'on' : ''}`}
            style={settings.modeId === m.id ? { borderColor: `${m.accent}66` } : undefined}
            onClick={() => {
              tap('select');
              setMode(m.id);
              go('setup');
            }}
          >
            <div className="mode-head">
              <span className="mode-emoji">{m.emoji}</span>
              <div className="grow">
                <div className="mode-name">{m.name}</div>
                <div className="mode-tagline">{m.tagline}</div>
              </div>
              <span className="chip">
                {m.minPlayers === m.maxPlayers ? m.minPlayers : `${m.minPlayers}–${m.maxPlayers}`} 👥
              </span>
            </div>
            <p className="muted" style={{ marginTop: 11, fontSize: 13.5 }}>
              {m.description}
            </p>
            <div className="wrap" style={{ marginTop: 12 }}>
              {m.bullets.map((b) => (
                <span key={b} className="chip">
                  {b}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </Screen>
  );
}

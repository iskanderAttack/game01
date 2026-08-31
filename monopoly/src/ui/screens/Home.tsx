import { useState } from 'react';
import { useApp } from '../../store/appStore';
import { Screen, Sheet } from '../components/Shell';
import { AVATAR_EMOJI } from '../../game/avatars';
import { tap } from '../../lib/feedback';

export function HomeScreen() {
  const go = useApp((s) => s.go);
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const [editing, setEditing] = useState(false);

  const open = (screen: Parameters<typeof go>[0]) => {
    tap('select');
    go(screen);
  };

  return (
    <Screen name="home" className="home">
      <button className="profile-badge" onClick={() => { tap(); setEditing(true); }}>
        <span style={{ fontSize: 20 }}>{profile.emoji}</span>
        <span>{profile.name}</span>
        <span style={{ opacity: 0.5 }}>✎</span>
      </button>

      <div className="scroll">
        <div className="home-hero">
          <div className="home-tokens">
            <span>🎩</span>
            <span>🚗</span>
            <span>🐕</span>
          </div>
          <h1 className="home-title">Монополия</h1>
          <p className="home-sub">
            Скупайте улицы, стройте отели и разоряйте соседей. Классические правила,
            рубли и режим большого развития — каждый со своего телефона.
          </p>
        </div>

        <button className="menu-card big" onClick={() => open('net')}>
          <span className="menu-emoji">📶</span>
          <span className="grow">
            <span className="menu-title">Играть по Wi-Fi</span>
            <span className="menu-note">Каждый со своего телефона, в одной сети</span>
          </span>
        </button>

        <button className="menu-card" onClick={() => open('modes')}>
          <span className="menu-emoji">🎲</span>
          <span className="grow">
            <span className="menu-title">На этом устройстве</span>
            <span className="menu-note">По очереди или против ботов</span>
          </span>
        </button>

        <button className="menu-card" onClick={() => open('academy')}>
          <span className="menu-emoji">📖</span>
          <span className="grow">
            <span className="menu-title">Правила</span>
            <span className="menu-note">Как играть и что решает партию</span>
          </span>
        </button>

        <button className="menu-card" onClick={() => open('history')}>
          <span className="menu-emoji">📜</span>
          <span className="grow">
            <span className="menu-title">История партий</span>
            <span className="menu-note">Кто побеждал и с каким капиталом</span>
          </span>
        </button>

        <button className="menu-card" onClick={() => open('games')}>
          <span className="menu-emoji">🎁</span>
          <span className="grow">
            <span className="menu-title">Наши игры</span>
            <span className="menu-note">Что ещё можно поставить на телефон</span>
          </span>
        </button>

        <button className="menu-card" onClick={() => open('settings')}>
          <span className="menu-emoji">⚙️</span>
          <span className="grow">
            <span className="menu-title">Настройки</span>
            <span className="menu-note">Звук, вибрация, правила</span>
          </span>
        </button>
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Ваша фишка">
        <div className="stack">
          <input
            className="field"
            value={profile.name}
            maxLength={14}
            placeholder="Ваше имя"
            onChange={(e) => setProfile({ name: e.target.value })}
          />
          <span className="label">Фишка</span>
          <div className="wrap">
            {AVATAR_EMOJI.map((e) => (
              <button
                key={e}
                className={`chip ${profile.emoji === e ? 'on' : ''}`}
                style={{ fontSize: 20, padding: '8px 11px' }}
                onClick={() => {
                  tap();
                  setProfile({ emoji: e });
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <button className="btn primary block" onClick={() => { tap('select'); setEditing(false); }}>
            Готово
          </button>
        </div>
      </Sheet>
    </Screen>
  );
}

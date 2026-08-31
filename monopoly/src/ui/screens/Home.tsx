import { useState } from 'react';
import { useApp } from '../../store/appStore';
import { Screen, Sheet } from '../components/Shell';
import { Critter } from '../components/Critter';
import { CHARACTERS, getCharacter } from '../../game/characters';
import { AVATAR_COLORS } from '../../game/avatars';
import { tap } from '../../lib/feedback';

/** Витрина на главной: три зверушки при параде. */
const HERO_OUTFITS = [{ head: 'tophat' }, { eyes: 'shades' }, { neck: 'bowtie' }];

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
        <span className="badge-critter">
          <Critter
            characterId={profile.character}
            outfit={profile.outfit}
            accent={profile.color}
            size={26}
          />
        </span>
        <span>{profile.name}</span>
        <span style={{ opacity: 0.5 }}>✎</span>
      </button>

      <div className="scroll">
        <div className="home-hero">
          <div className="home-tokens">
            {['fox', 'panda', 'penguin'].map((id, i) => (
              <span key={id}>
                <Critter characterId={id} outfit={HERO_OUTFITS[i]} size={54} phase={i * 3} />
              </span>
            ))}
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
          <div className="card row" style={{ gap: 14, alignItems: 'center' }}>
            <div className="boutique-preview">
              <Critter
                characterId={profile.character}
                outfit={profile.outfit}
                accent={profile.color}
                size={90}
              />
            </div>
            <div className="grow">
              <div style={{ fontWeight: 740 }}>{getCharacter(profile.character).name}</div>
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Наряд покупается в бутике прямо во время партии и остаётся
                с вами в следующих.
              </p>
            </div>
          </div>

          <span className="label">Зверушка</span>
          <div className="critter-picker">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                className={`critter-pick ${profile.character === c.id ? 'on' : ''}`}
                onClick={() => {
                  tap();
                  setProfile({ character: c.id, emoji: c.emoji });
                }}
                aria-label={c.name}
              >
                <Critter characterId={c.id} outfit={profile.outfit} accent={c.accent} size={44} animate={false} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>

          <span className="label">Цвет</span>
          <div className="wrap">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                className={`color-pick ${profile.color === c ? 'on' : ''}`}
                style={{ background: c }}
                onClick={() => {
                  tap();
                  setProfile({ color: c });
                }}
                aria-label="Цвет игрока"
              />
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

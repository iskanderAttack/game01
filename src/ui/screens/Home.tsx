import { motion } from 'framer-motion';
import { useApp } from '../../store/appStore';
import { Screen } from '../components/Shell';
import { tap } from '../../lib/feedback';
import { AVATARS, COLORS } from '../../game/avatars';
import { useState } from 'react';

export function HomeScreen() {
  const go = useApp((s) => s.go);
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const [editing, setEditing] = useState(false);

  const items = [
    {
      id: 'modes',
      emoji: '🎮',
      title: 'Играть',
      desc: 'Один телефон на компанию или семью',
      accent: '#7C5CFF',
      onClick: () => go('modes'),
      big: true,
    },
    {
      id: 'net',
      emoji: '📶',
      title: 'По Wi-Fi',
      desc: 'Каждый со своего телефона',
      accent: '#2DD4BF',
      onClick: () => go('net'),
    },
    {
      id: 'academy',
      emoji: '🎓',
      title: 'Академия',
      desc: 'Что это за дилемма',
      accent: '#FFB020',
      onClick: () => go('academy'),
    },
    {
      id: 'strategies',
      emoji: '🤖',
      title: 'Стратегии',
      desc: '12 характеров',
      accent: '#F472B6',
      onClick: () => go('strategies'),
    },
    {
      id: 'games',
      emoji: '🎁',
      title: 'Наши игры',
      desc: 'Что ещё можно поставить на телефон',
      accent: '#34D399',
      onClick: () => go('games'),
    },
    {
      id: 'settings',
      emoji: '⚙️',
      title: 'Настройки',
      desc: 'Звук, вибрация, правила',
      accent: '#60A5FA',
      onClick: () => go('settings'),
    },
  ];

  return (
    <Screen name="home" className="home">
      <div className="home-head">
        <motion.button
          className="profile-badge"
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            tap();
            setEditing((v) => !v);
          }}
        >
          <span className="profile-emoji" style={{ background: `${profile.color}33`, borderColor: profile.color }}>
            {profile.emoji}
          </span>
          <span className="profile-name">{profile.name}</span>
          <span className="profile-edit">✎</span>
        </motion.button>
      </div>

      {editing && (
        <motion.div className="card" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <span className="label">Как вас звать</span>
          <input
            type="text"
            value={profile.name}
            maxLength={14}
            onChange={(e) => setProfile({ name: e.target.value })}
            style={{ marginTop: 8 }}
          />
          <span className="label" style={{ display: 'block', marginTop: 14 }}>
            Аватар
          </span>
          <div className="avatar-picker">
            {AVATARS.map((a) => (
              <button
                key={a}
                className={`avatar-option ${a === profile.emoji ? 'on' : ''}`}
                onClick={() => {
                  tap();
                  setProfile({ emoji: a });
                }}
              >
                {a}
              </button>
            ))}
          </div>
          <span className="label" style={{ display: 'block', marginTop: 14 }}>
            Цвет
          </span>
          <div className="wrap" style={{ marginTop: 8 }}>
            {COLORS.map((c) => (
              <button
                key={c}
                className={`color-dot ${c === profile.color ? 'on' : ''}`}
                style={{ background: c }}
                onClick={() => {
                  tap();
                  setProfile({ color: c });
                }}
              />
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        className="hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="hero-cards">
          <motion.div
            className="hero-card c"
            animate={{ rotate: [-9, -6, -9], y: [0, -6, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            🤝
          </motion.div>
          <motion.div
            className="hero-card d"
            animate={{ rotate: [9, 12, 9], y: [0, -9, 0] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          >
            🔪
          </motion.div>
        </div>
        <h1 className="display gradient-text">
          Дилемма
          <br />
          заключённого
        </h1>
        <p className="muted" style={{ marginTop: 10, maxWidth: 320 }}>
          Игра о доверии, жадности и репутации. От двоих до шестнадцати — за одним столом или по Wi-Fi.
        </p>
      </motion.div>

      <div className="menu-grid">
        {items.map((it, i) => (
          <motion.button
            key={it.id}
            className={`menu-card ${it.big ? 'big' : ''}`}
            style={{ ['--card-accent' as string]: it.accent }}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.05, type: 'spring', stiffness: 260, damping: 24 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              tap('select');
              it.onClick();
            }}
          >
            <span className="menu-emoji">{it.emoji}</span>
            <span className="menu-title">{it.title}</span>
            <span className="menu-desc">{it.desc}</span>
          </motion.button>
        ))}
      </div>
    </Screen>
  );
}

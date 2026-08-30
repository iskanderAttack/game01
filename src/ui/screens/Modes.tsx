import { motion } from 'framer-motion';
import { GAME_MODES } from '../../game/modes';
import { useApp } from '../../store/appStore';
import { Screen, TopBar } from '../components/Shell';
import { tap } from '../../lib/feedback';

export function ModesScreen() {
  const go = useApp((s) => s.go);
  const chooseMode = useApp((s) => s.chooseMode);

  return (
    <Screen>
      <TopBar title="Режимы" subtitle="Правила подстраиваются под число игроков" onBack={() => go('home')} />
      <div className="scroll">
        {GAME_MODES.map((mode, i) => (
          <motion.button
            key={mode.id}
            className="mode-card card glow"
            style={{ ['--card-accent' as string]: mode.accent, borderColor: `${mode.accent}44` }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, type: 'spring', stiffness: 250, damping: 24 }}
            whileTap={{ scale: 0.975 }}
            onClick={() => {
              tap('select');
              chooseMode(mode.id);
            }}
          >
            <div className="mode-glow" />
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="mode-emoji">{mode.emoji}</span>
              <div className="grow" style={{ textAlign: 'left' }}>
                <div className="mode-name">{mode.name}</div>
                <div className="mode-tagline">{mode.tagline}</div>
              </div>
              <span className="mode-players chip">
                👥 {mode.minPlayers === mode.maxPlayers ? mode.minPlayers : `${mode.minPlayers}–${mode.maxPlayers}`}
              </span>
            </div>
            <p className="muted" style={{ marginTop: 10, textAlign: 'left', fontSize: 13.5 }}>
              {mode.description}
            </p>
            <div className="wrap" style={{ marginTop: 12 }}>
              {mode.bullets.map((b) => (
                <span key={b} className="chip">
                  {b}
                </span>
              ))}
            </div>
          </motion.button>
        ))}
      </div>
    </Screen>
  );
}

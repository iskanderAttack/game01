import { motion } from 'framer-motion';
import { STRATEGIES } from '../../game/strategies';
import { useApp } from '../../store/appStore';
import { Screen, TopBar } from '../components/Shell';

export function StrategiesScreen() {
  const go = useApp((s) => s.go);

  return (
    <Screen name="strategies">
      <TopBar title="Стратегии" subtitle="Характеры, которые можно позвать в партию" onBack={() => go('home')} />
      <div className="scroll">
        <p className="muted">
          Это не просто «лёгкие» и «сложные» боты — каждый воплощает реальную стратегию из турниров по теории
          игр. Точки справа показывают, насколько с ним трудно.
        </p>
        {STRATEGIES.map((s, i) => (
          <motion.div
            key={s.id}
            className="card strategy-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.035 }}
          >
            <div className="row">
              <span className="strategy-big-emoji">{s.emoji}</span>
              <div className="grow">
                <div className="strategy-name">{s.name}</div>
                <div className="strategy-short">{s.short}</div>
              </div>
              <span className="difficulty big">{'●'.repeat(s.difficulty)}<span className="dim">{'●'.repeat(5 - s.difficulty)}</span></span>
            </div>
            <p className="muted" style={{ marginTop: 10, fontSize: 13.5 }}>
              {s.description}
            </p>
          </motion.div>
        ))}
      </div>
    </Screen>
  );
}

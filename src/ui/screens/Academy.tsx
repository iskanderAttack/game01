import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { THEORY } from '../../game/hints';
import { ACHIEVEMENTS } from '../../game/achievements';
import { useApp } from '../../store/appStore';
import { Screen, TopBar, SectionTitle } from '../components/Shell';
import { tap } from '../../lib/feedback';

export function AcademyScreen() {
  const go = useApp((s) => s.go);
  const [open, setOpen] = useState<string | null>(THEORY[0].id);

  return (
    <Screen name="academy">
      <TopBar title="Академия" subtitle="Полторы минуты теории игр" onBack={() => go('home')} />
      <div className="scroll">
        <div className="card matrix-demo">
          <span className="label">Классическая матрица</span>
          <div className="matrix" style={{ marginTop: 12 }}>
            <div />
            <div className="mh">Он молчит</div>
            <div className="mh">Он сдаёт</div>
            <div className="mh">Я молчу</div>
            <div className="mc good">3 / 3</div>
            <div className="mc bad">0 / 5</div>
            <div className="mh">Я сдаю</div>
            <div className="mc bad">5 / 0</div>
            <div className="mc">1 / 1</div>
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 13.5 }}>
            Что бы ни сделал напарник, лично мне выгоднее сдать. То же самое верно и для него. И вот мы оба
            получаем по единице вместо тройки.
          </p>
        </div>

        {THEORY.map((t, i) => (
          <motion.button
            key={t.id}
            className={`theory-card card ${open === t.id ? 'on' : ''}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => {
              tap();
              setOpen(open === t.id ? null : t.id);
            }}
          >
            <div className="row">
              <span className="theory-emoji">{t.emoji}</span>
              <span className="grow theory-title">{t.title}</span>
              <span className="theory-chevron">{open === t.id ? '−' : '+'}</span>
            </div>
            <AnimatePresence initial={false}>
              {open === t.id && (
                <motion.p
                  className="muted theory-text"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {t.text}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.button>
        ))}

        <SectionTitle>Достижения</SectionTitle>
        <div className="card stack">
          {ACHIEVEMENTS.map((a) => (
            <div key={a.id} className="row achievement-row">
              <span className={`achievement ${a.rarity}`}>{a.emoji}</span>
              <div className="grow">
                <div style={{ fontWeight: 650, fontSize: 14.5 }}>{a.name}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {a.description}
                </div>
              </div>
              <span className={`rarity ${a.rarity}`}>
                {a.rarity === 'legendary' ? 'легенда' : a.rarity === 'rare' ? 'редкое' : 'обычное'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

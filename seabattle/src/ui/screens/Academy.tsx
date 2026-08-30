import { useState } from 'react';
import { useApp } from '../../store/appStore';
import { THEORY } from '../../game/academy';
import { ABILITIES } from '../../game/abilities';
import { BOT_LEVELS } from '../../game/bots';
import { ROLE_INFO } from '../../game/fleet';
import { Screen, SectionTitle, TopBar } from '../components/Shell';
import { Segmented } from '../components/controls';

type Tab = 'theory' | 'abilities' | 'bots';

export function AcademyScreen() {
  const go = useApp((s) => s.go);
  const [tab, setTab] = useState<Tab>('theory');

  return (
    <Screen name="academy">
      <TopBar title="Академия" subtitle="Как играть лучше" onBack={() => go('home')} />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'theory', label: 'Тактика', emoji: '🧭' },
          { value: 'abilities', label: 'Штаб', emoji: '🎖️' },
          { value: 'bots', label: 'Боты', emoji: '🤖' },
        ]}
      />

      <div className="scroll">
        {tab === 'theory' &&
          THEORY.map((t) => (
            <div key={t.id} className="theory-card">
              <div className="theory-title">
                <span style={{ fontSize: 22 }}>{t.emoji}</span>
                {t.title}
              </div>
              <p className="theory-text">{t.text}</p>
            </div>
          ))}

        {tab === 'abilities' && (
          <>
            <div className="notice">
              Способности работают в режиме «Адмирал» и включаются галочкой в настройках партии.
              Энергия копится за попадания: +1 за палубу и +3 за потопленный корабль.
            </div>
            {ABILITIES.map((a) => (
              <div key={a.id} className="theory-card">
                <div className="theory-title">
                  <span style={{ fontSize: 22 }}>{a.emoji}</span>
                  {a.name}
                  <span className="chip" style={{ marginLeft: 'auto' }}>
                    {a.cost} ⚡
                  </span>
                </div>
                <p className="theory-text">{a.description}</p>
              </div>
            ))}

            <SectionTitle>Корабли</SectionTitle>
            {Object.entries(ROLE_INFO).map(([role, info]) => (
              <div key={role} className="card row">
                <span style={{ fontSize: 24 }}>{info.emoji}</span>
                <div className="grow">
                  <div style={{ fontWeight: 680 }}>{info.name}</div>
                  <div className="setting-hint">{info.note}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'bots' &&
          BOT_LEVELS.map((b) => (
            <div key={b.id} className="theory-card">
              <div className="theory-title">
                <span style={{ fontSize: 22 }}>{b.emoji}</span>
                {b.name}
              </div>
              <p className="theory-text">{b.description}</p>
            </div>
          ))}
      </div>
    </Screen>
  );
}

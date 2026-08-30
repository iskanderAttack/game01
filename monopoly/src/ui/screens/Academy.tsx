import { useState } from 'react';
import { useApp } from '../../store/appStore';
import { RULES } from '../../game/academy';
import { BOT_LEVELS } from '../../game/bots';
import { BOARD, GROUP_COLORS, GROUP_NAMES, groupTiles } from '../../game/board';
import { money } from '../../game/money';
import { Screen, TopBar } from '../components/Shell';
import { Segmented } from '../components/controls';

type Tab = 'rules' | 'board' | 'bots';

export function AcademyScreen() {
  const go = useApp((s) => s.go);
  const [tab, setTab] = useState<Tab>('rules');

  const groups = Object.keys(GROUP_NAMES) as (keyof typeof GROUP_NAMES)[];

  return (
    <Screen name="academy">
      <TopBar title="Правила" subtitle="Всё, что нужно помнить" onBack={() => go('home')} />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'rules', label: 'Правила', emoji: '📖' },
          { value: 'board', label: 'Доска', emoji: '🗺️' },
          { value: 'bots', label: 'Боты', emoji: '🤖' },
        ]}
      />

      <div className="scroll">
        {tab === 'rules' &&
          RULES.map((r) => (
            <div key={r.id} className="theory-card">
              <div className="theory-title">
                <span style={{ fontSize: 22 }}>{r.emoji}</span>
                {r.title}
              </div>
              <p className="theory-text">{r.text}</p>
            </div>
          ))}

        {tab === 'board' && (
          <>
            <div className="notice">
              Сорок клеток: восемь цветных групп, четыре вокзала, две коммунальные службы,
              два налога и шесть карточных клеток.
            </div>
            {groups.map((g) => {
              const tiles = groupTiles(g).map((i) => BOARD[i]);
              return (
                <div key={g} className="card stack" style={{ padding: 12 }}>
                  <div className="row">
                    <span className="dot" style={{ background: GROUP_COLORS[g], width: 14, height: 14 }} />
                    <b>{GROUP_NAMES[g]}</b>
                    <span className="grow" />
                    <span className="chip">дом {money(tiles[0].houseCost ?? 0)}</span>
                  </div>
                  {tiles.map((t) => (
                    <div key={t.index} className="row between">
                      <span className="muted" style={{ fontSize: 13.5 }}>{t.name}</span>
                      <span className="mono" style={{ fontSize: 13 }}>{money(t.price ?? 0)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="card stack" style={{ padding: 12 }}>
              <b>🚂 Вокзалы</b>
              <div className="setting-hint">
                Каждый стоит 200 тысяч. Аренда зависит от числа вокзалов у владельца:
                25, 50, 100 и 200 тысяч.
              </div>
              <b style={{ marginTop: 6 }}>💡 Коммунальные службы</b>
              <div className="setting-hint">
                Электростанция и водопровод по 150 тысяч. Аренда — выпавший бросок, умноженный
                на четыре, а если у владельца обе службы — на десять.
              </div>
            </div>
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

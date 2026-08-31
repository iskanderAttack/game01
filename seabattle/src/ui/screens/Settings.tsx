import { useState } from 'react';
import { DEFAULT_SETTINGS, useApp } from '../../store/appStore';
import { Screen, SectionTitle, TopBar } from '../components/Shell';
import { Toggle } from '../components/controls';
import { diagEntries, diagText } from '../../lib/diag';
import { play, tap } from '../../lib/feedback';

export function SettingsScreen() {
  const go = useApp((s) => s.go);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);

  return (
    <Screen name="settings">
      <TopBar title="Настройки" onBack={() => go('home')} />

      <div className="scroll">
        <SectionTitle>Ощущения</SectionTitle>
        <div className="card stack">
          <Toggle
            emoji="🔊"
            label="Звук"
            hint="всплески и взрывы синтезируются на лету"
            value={settings.sound}
            onChange={(v) => {
              setSettings({ sound: v });
              if (v) setTimeout(() => play('splash'), 60);
            }}
          />
          <Toggle
            emoji="📳"
            label="Вибрация"
            hint="отклик на выстрел и попадание"
            value={settings.haptics}
            onChange={(v) => setSettings({ haptics: v })}
          />
        </div>

        <SectionTitle>Правила по умолчанию</SectionTitle>
        <div className="card stack">
          <Toggle
            emoji="💡"
            label="Подсказки"
            hint="«горячо — холодно» после промаха"
            value={settings.hints}
            onChange={(v) => setSettings({ hints: v })}
          />
          <Toggle
            emoji="📐"
            label="Корабли могут касаться"
            hint="выключено — вокруг корабля всегда есть вода"
            value={settings.allowTouching}
            onChange={(v) => setSettings({ allowTouching: v })}
          />
        </div>

        <button
          className="btn block"
          onClick={() => {
            tap();
            setSettings({ ...DEFAULT_SETTINGS });
          }}
        >
          Сбросить к заводским
        </button>

        <DiagnosticsCard />

        <div className="card">
          <div className="row">
            <span style={{ fontSize: 30 }}>⚓</span>
            <div>
              <div style={{ fontWeight: 700 }}>Морской бой</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Версия 1.0.7 · офлайн и по Wi-Fi
              </div>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            Игра не собирает и никуда не отправляет данные. Сетевой режим работает только внутри
            вашей локальной сети.
          </p>
        </div>
      </div>
    </Screen>
  );
}

/** Журнал последних событий — чтобы было что показать, если что-то сломалось. */
function DiagnosticsCard() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const entries = diagEntries();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(diagText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="card stack">
      <button
        className="row between"
        style={{ background: 'none', border: 0, padding: 0, width: '100%', color: 'inherit' }}
        onClick={() => {
          tap();
          setOpen((v) => !v);
        }}
      >
        <span className="label">🩺 Диагностика</span>
        <span className="muted">{open ? 'скрыть' : 'показать'}</span>
      </button>

      {open && (
        <>
          <p className="muted" style={{ fontSize: 13 }}>
            Последние {entries.length} событий этого запуска. Если игра повела себя странно,
            скопируйте журнал и пришлите — по нему видно, что случилось.
          </p>
          <div
            className="mono"
            style={{
              fontSize: 11,
              lineHeight: 1.6,
              maxHeight: 200,
              overflowY: 'auto',
              opacity: 0.75,
              wordBreak: 'break-word',
            }}
          >
            {entries.length === 0 && <div>Пока пусто.</div>}
            {entries.map((e, i) => (
              <div key={i}>
                {new Date(e.at).toLocaleTimeString('ru-RU')} · {e.tag}
                {e.info ? ' — ' + e.info : ''}
              </div>
            ))}
          </div>
          <button className="btn block" onClick={copy}>
            {copied ? 'Скопировано ✓' : 'Скопировать журнал'}
          </button>
        </>
      )}
    </div>
  );
}

import { useApp, DEFAULT_SETTINGS } from '../../store/appStore';
import { Screen, TopBar, SectionTitle } from '../components/Shell';
import { Segmented, Stepper, Toggle } from '../components/controls';
import { play, tap } from '../../lib/feedback';

export function SettingsScreen() {
  const go = useApp((s) => s.go);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);

  return (
    <Screen>
      <TopBar title="Настройки" onBack={() => go('home')} />
      <div className="scroll">
        <SectionTitle>Ощущения</SectionTitle>
        <div className="card stack">
          <Toggle
            emoji="🔊"
            label="Звук"
            hint="синтезированные тона, без файлов"
            value={settings.sound}
            onChange={(v) => {
              setSettings({ sound: v });
              if (v) setTimeout(() => play('coop'), 60);
            }}
          />
          <Toggle
            emoji="📳"
            label="Вибрация"
            hint="тактильный отклик на выбор"
            value={settings.haptics}
            onChange={(v) => setSettings({ haptics: v })}
          />
          <div className="divider" />
          <div>
            <div className="setting-label" style={{ marginBottom: 8 }}>
              🎬 Скорость вскрытия
            </div>
            <Segmented
              value={
                settings.revealSpeed <= 0.7 ? 'fast' : settings.revealSpeed >= 1.4 ? 'slow' : 'normal'
              }
              onChange={(v) =>
                setSettings({ revealSpeed: v === 'fast' ? 0.6 : v === 'slow' ? 1.6 : 1 })
              }
              options={[
                { value: 'fast', label: 'Быстро', emoji: '⚡' },
                { value: 'normal', label: 'Обычно', emoji: '🎞️' },
                { value: 'slow', label: 'Смакуя', emoji: '🍷' },
              ]}
            />
          </div>
        </div>

        <SectionTitle>Правила по умолчанию</SectionTitle>
        <div className="card stack">
          <Toggle
            emoji="💡"
            label="Подсказки"
            hint="контекстные советы во время хода"
            value={settings.hints}
            onChange={(v) => setSettings({ hints: v })}
          />
          <Toggle
            emoji="🕶️"
            label="Анонимное вскрытие"
            hint="скрывать, кто именно как сходил"
            value={settings.anonymous}
            onChange={(v) => setSettings({ anonymous: v })}
          />
          <div className="divider" />
          <Stepper
            emoji="🔁"
            label="Раундов"
            value={settings.rounds}
            min={3}
            max={40}
            onChange={(v) => setSettings({ rounds: v })}
          />
          <Stepper
            emoji="⏱"
            label="Таймер на ход"
            value={settings.timer}
            min={0}
            max={60}
            step={5}
            onChange={(v) => setSettings({ timer: v })}
            format={(v) => (v === 0 ? 'выкл' : `${v} с`)}
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

        <div className="card about">
          <div className="row">
            <span style={{ fontSize: 30 }}>🤝</span>
            <div>
              <div style={{ fontWeight: 700 }}>Дилемма заключённого</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Версия 1.0 · офлайн и по Wi-Fi
              </div>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            Игра не собирает и никуда не отправляет данные. Сетевой режим работает только внутри вашей
            локальной сети.
          </p>
        </div>
      </div>
    </Screen>
  );
}

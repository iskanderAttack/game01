import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../store/appStore';
import { getMode } from '../../game/modes';
import { PAYOFF_PRESETS } from '../../game/payoffs';
import { STRATEGIES } from '../../game/strategies';
import { AVATARS, COLORS } from '../../game/avatars';
import { Screen, TopBar, SectionTitle, Sheet } from '../components/Shell';
import { Segmented, Stepper, Toggle } from '../components/controls';
import { Avatar } from '../components/PlayerBits';
import { tap } from '../../lib/feedback';
import type { Player } from '../../game/types';

export function SetupScreen() {
  const go = useApp((s) => s.go);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const setPayoffPreset = useApp((s) => s.setPayoffPreset);
  const draft = useApp((s) => s.draft);
  const addHuman = useApp((s) => s.addHuman);
  const addBot = useApp((s) => s.addBot);
  const removePlayer = useApp((s) => s.removePlayer);
  const updatePlayer = useApp((s) => s.updatePlayer);
  const shufflePlayers = useApp((s) => s.shufflePlayers);
  const startGame = useApp((s) => s.startGame);

  const [editing, setEditing] = useState<Player | null>(null);
  const [botPicker, setBotPicker] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  const mode = getMode(settings.modeId);
  const canAdd = draft.length < mode.maxPlayers;
  const enough = draft.length >= mode.minPlayers;
  const humans = draft.filter((p) => !p.isBot).length;

  return (
    <Screen name="setup">
      <TopBar
        title={`${mode.emoji} ${mode.name}`}
        subtitle={mode.tagline}
        onBack={() => go('modes')}
        right={
          <button className="icon-btn" onClick={() => { tap(); shufflePlayers(); }} aria-label="Перемешать">
            🔀
          </button>
        }
      />

      <div className="scroll">
        <SectionTitle hint={`${draft.length} / ${mode.maxPlayers}`}>Игроки</SectionTitle>

        <div className="players-list">
          <AnimatePresence initial={false}>
            {draft.map((p, i) => (
              <motion.div
                key={p.id}
                layout
                className="player-row card"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24, height: 0, padding: 0, margin: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              >
                <span className="player-index mono">{i + 1}</span>
                <button
                  onClick={() => {
                    tap();
                    setEditing(p);
                  }}
                  className="row grow"
                  style={{ textAlign: 'left' }}
                >
                  <Avatar player={p} size={42} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="player-name">{p.name}</div>
                    <div className="player-sub">
                      {p.isBot ? `🤖 ${STRATEGIES.find((s) => s.id === p.strategyId)?.short ?? 'бот'}` : '🙋 живой игрок'}
                    </div>
                  </div>
                </button>
                <button
                  className="icon-btn small-icon"
                  aria-label="Убрать"
                  onClick={() => {
                    tap();
                    removePlayer(p.id);
                  }}
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="row">
          <button className="btn grow" disabled={!canAdd} onClick={() => { tap('select'); addHuman(); }}>
            + Игрок
          </button>
          <button className="btn grow" disabled={!canAdd} onClick={() => { tap('select'); setBotPicker(true); }}>
            + Бот
          </button>
        </div>

        {!enough && (
          <div className="notice warn">
            Для режима «{mode.name}» нужно минимум {mode.minPlayers} участника.
          </div>
        )}
        {mode.structure === 'pairs' && draft.length % 2 === 1 && draft.length > 2 && (
          <div className="notice">
            Игроков нечётное количество — каждый раунд кто-то один отдыхает и получает утешительные очки.
          </div>
        )}

        <SectionTitle>Правила партии</SectionTitle>

        <div className="card stack">
          <Stepper
            emoji="🔁"
            label="Раундов"
            hint={settings.endingRule === 'unknown' ? 'примерно — точный финал скрыт' : 'фиксированная длина'}
            value={settings.rounds}
            min={3}
            max={40}
            onChange={(v) => setSettings({ rounds: v })}
          />
          <div className="divider" />
          <div>
            <div className="setting-label" style={{ marginBottom: 8 }}>
              Когда закончится партия
            </div>
            <Segmented
              value={settings.endingRule}
              onChange={(v) => setSettings({ endingRule: v })}
              options={[
                { value: 'fixed', label: 'Известно', emoji: '📅' },
                { value: 'unknown', label: 'Сюрприз', emoji: '🎲' },
              ]}
            />
            <div className="setting-hint" style={{ marginTop: 8 }}>
              {settings.endingRule === 'unknown'
                ? 'Никто не знает последний раунд — предавать «под занавес» рискованно.'
                : 'Все знают номер последнего раунда. Ждите массового предательства в конце.'}
            </div>
          </div>
        </div>

        <SectionTitle>Матрица выплат</SectionTitle>
        <div className="preset-row">
          {PAYOFF_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`preset-card ${settings.payoffId === p.id ? 'on' : ''}`}
              onClick={() => {
                tap('select');
                setPayoffPreset(p.id);
              }}
            >
              <span className="preset-emoji">{p.emoji}</span>
              <span className="preset-name">{p.name}</span>
              <span className="preset-nums mono">
                {p.payoff.R}/{p.payoff.T}/{p.payoff.P}/{p.payoff.S}
              </span>
            </button>
          ))}
        </div>
        <div className="setting-hint">{PAYOFF_PRESETS.find((p) => p.id === settings.payoffId)?.description}</div>

        <button className="btn ghost block" onClick={() => { tap(); setAdvanced((v) => !v); }}>
          {advanced ? 'Скрыть' : 'Больше настроек'} {advanced ? '▲' : '▼'}
        </button>

        <AnimatePresence>
          {advanced && (
            <motion.div
              className="card stack"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <Stepper
                emoji="🌫️"
                label="Туман недопонимания"
                hint="шанс, что ход исказится"
                value={Math.round(settings.noise * 100)}
                min={0}
                max={40}
                step={5}
                suffix="%"
                onChange={(v) => setSettings({ noise: v / 100 })}
              />
              <div className="divider" />
              <Stepper
                emoji="⏱"
                label="Таймер на ход"
                hint="0 — без ограничения"
                value={settings.timer}
                min={0}
                max={60}
                step={5}
                onChange={(v) => setSettings({ timer: v })}
                format={(v) => (v === 0 ? 'выкл' : `${v} с`)}
              />
              {mode.structure === 'commons' && (
                <>
                  <div className="divider" />
                  <Stepper
                    emoji="✖️"
                    label="Множитель котла"
                    hint="во сколько раз растёт общий вклад"
                    value={settings.commonsMultiplier}
                    min={1.2}
                    max={4}
                    step={0.2}
                    onChange={(v) => setSettings({ commonsMultiplier: Math.round(v * 10) / 10 })}
                    format={(v) => `×${v}`}
                  />
                </>
              )}
              <div className="divider" />
              <Toggle
                emoji="🌀"
                label="Случайные события"
                hint="удвоение ставок, амнистия, затемнение"
                value={settings.events}
                onChange={(v) => setSettings({ events: v })}
              />
              <Toggle
                emoji="💡"
                label="Подсказки"
                hint="советы по ходу партии"
                value={settings.hints}
                onChange={(v) => setSettings({ hints: v })}
              />
              <Toggle
                emoji="🕶️"
                label="Анонимное вскрытие"
                hint="видно только сколько сотрудничали"
                value={settings.anonymous}
                onChange={(v) => setSettings({ anonymous: v })}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        className="btn primary block start-btn"
        disabled={!enough}
        onClick={() => {
          tap('select');
          startGame();
        }}
      >
        Начать · {draft.length} {plural(draft.length, 'игрок', 'игрока', 'игроков')}
        {humans > 1 ? ' 📱' : ''}
      </button>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Игрок">
        {editing && (
          <div className="stack">
            <input
              type="text"
              value={editing.name}
              maxLength={14}
              onChange={(e) => {
                updatePlayer(editing.id, { name: e.target.value });
                setEditing({ ...editing, name: e.target.value });
              }}
            />
            <span className="label">Аватар</span>
            <div className="avatar-picker">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  className={`avatar-option ${a === editing.emoji ? 'on' : ''}`}
                  onClick={() => {
                    tap();
                    updatePlayer(editing.id, { emoji: a });
                    setEditing({ ...editing, emoji: a });
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
            <span className="label">Цвет</span>
            <div className="wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`color-dot ${c === editing.color ? 'on' : ''}`}
                  style={{ background: c }}
                  onClick={() => {
                    tap();
                    updatePlayer(editing.id, { color: c });
                    setEditing({ ...editing, color: c });
                  }}
                />
              ))}
            </div>
            {editing.isBot && (
              <>
                <span className="label">Стратегия</span>
                <div className="stack">
                  {STRATEGIES.map((s) => (
                    <button
                      key={s.id}
                      className={`strategy-pick ${editing.strategyId === s.id ? 'on' : ''}`}
                      onClick={() => {
                        tap('select');
                        updatePlayer(editing.id, { strategyId: s.id, name: s.name, emoji: s.emoji });
                        setEditing({ ...editing, strategyId: s.id, name: s.name, emoji: s.emoji });
                      }}
                    >
                      <span className="strategy-emoji">{s.emoji}</span>
                      <span className="grow" style={{ textAlign: 'left' }}>
                        <b>{s.name}</b>
                        <br />
                        <span className="muted" style={{ fontSize: 12.5 }}>{s.short}</span>
                      </span>
                      <span className="difficulty">{'●'.repeat(s.difficulty)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <button className="btn primary block" onClick={() => setEditing(null)}>
              Готово
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={botPicker} onClose={() => setBotPicker(false)} title="Добавить бота">
        <div className="stack">
          {STRATEGIES.map((s) => (
            <button
              key={s.id}
              className="strategy-pick"
              onClick={() => {
                tap('select');
                addBot(s.id);
                setBotPicker(false);
              }}
            >
              <span className="strategy-emoji">{s.emoji}</span>
              <span className="grow" style={{ textAlign: 'left' }}>
                <b>{s.name}</b>
                <br />
                <span className="muted" style={{ fontSize: 12.5 }}>{s.short}</span>
              </span>
              <span className="difficulty">{'●'.repeat(s.difficulty)}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </Screen>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

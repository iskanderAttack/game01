import { useEffect } from 'react';
import { useApp } from '../../store/appStore';
import { getMode } from '../../game/modes';
import { FLEETS, fleetDensity, getFleet } from '../../game/fleet';
import { BOT_LEVELS } from '../../game/bots';
import { Screen, SectionTitle, TopBar } from '../components/Shell';
import { Segmented, Stepper, Toggle } from '../components/controls';
import { Avatar } from '../components/PlayerBits';
import { tap } from '../../lib/feedback';

export function SetupScreen() {
  const go = useApp((s) => s.go);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const draft = useApp((s) => s.draft);
  const addHuman = useApp((s) => s.addHuman);
  const addBot = useApp((s) => s.addBot);
  const removePlayer = useApp((s) => s.removePlayer);
  const resetDraft = useApp((s) => s.resetDraft);
  const startGame = useApp((s) => s.startGame);

  const mode = getMode(settings.modeId);
  const fleet = getFleet(settings.fleetId);
  const minSize = Math.max(...fleet.sizes) + 1;
  const density = fleetDensity(fleet.sizes, settings.boardSize);

  // Набираем состав под режим при первом входе.
  useEffect(() => {
    if (draft.length > 0) return;
    resetDraft();
    addHuman();
    for (let i = 0; i < mode.suggestedBots; i++) addBot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.id]);

  const enough = draft.length >= mode.minPlayers && draft.length <= mode.maxPlayers;
  const humans = draft.filter((p) => !p.isBot).length;

  return (
    <Screen name="setup">
      <TopBar
        title={`${mode.emoji} ${mode.name}`}
        subtitle={mode.tagline}
        onBack={() => go('modes')}
      />

      <div className="scroll">
        <SectionTitle>Кто играет</SectionTitle>
        <div className="players-list">
          {draft.map((p, i) => (
            <div key={p.id} className="player-row card" style={{ padding: 11 }}>
              <Avatar emoji={p.emoji} color={p.color} size={38} />
              <div className="grow">
                <div className="player-name">{p.name}</div>
                <div className="player-sub">
                  {p.isBot ? `🤖 ${BOT_LEVELS.find((b) => b.id === p.botLevel)?.name ?? 'бот'}` : '📱 это устройство'}
                  {mode.teams && ` · эскадра ${(i % 2) + 1}`}
                </div>
              </div>
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
            </div>
          ))}
        </div>

        <div className="row">
          <button
            className="btn grow"
            disabled={draft.length >= mode.maxPlayers || mode.id === 'hunt'}
            onClick={() => {
              tap();
              addHuman();
            }}
          >
            + Игрок
          </button>
          <button
            className="btn grow"
            disabled={draft.length >= mode.maxPlayers}
            onClick={() => {
              tap();
              addBot();
            }}
          >
            + Бот
          </button>
        </div>

        {!enough && (
          <div className="notice warn">
            Для «{mode.name}» нужно от {mode.minPlayers} до {mode.maxPlayers} участников.
          </div>
        )}
        {humans > 1 && (
          <div className="notice">
            Игроки на одном устройстве ходят по очереди — между ходами появится ширма, чтобы никто
            не подсмотрел чужое поле.
          </div>
        )}

        <SectionTitle>Флот</SectionTitle>
        <div className="card stack">
          <div className="mode-strip">
            {FLEETS.map((f) => (
              <button
                key={f.id}
                className={`mode-pill ${settings.fleetId === f.id ? 'on' : ''}`}
                onClick={() => {
                  tap('select');
                  setSettings({
                    fleetId: f.id,
                    boardSize: Math.max(f.boardSize, Math.max(...f.sizes) + 1),
                  });
                }}
              >
                <span>{f.emoji}</span>
                <b>{f.name}</b>
              </button>
            ))}
          </div>
          <div className="setting-hint">{fleet.description}</div>
          <div className="wrap">
            <span className="chip">🚢 кораблей {fleet.sizes.length}</span>
            <span className="chip">▦ палуб {fleet.sizes.reduce((a, b) => a + b, 0)}</span>
            <span className="chip">📐 плотность {Math.round(density * 100)}%</span>
          </div>
          {density > 0.28 && (
            <div className="notice warn">
              Флот тесновато сидит на поле — расстановка может не сойтись. Увеличьте поле или
              разрешите касание бортами.
            </div>
          )}

          <div className="divider" />
          <Stepper
            emoji="🗺️"
            label="Размер поля"
            value={settings.boardSize}
            min={minSize}
            max={14}
            onChange={(v) => setSettings({ boardSize: v })}
            format={(v) => `${v}×${v}`}
          />
        </div>

        <SectionTitle>Правила</SectionTitle>
        <div className="card stack">
          <Toggle
            emoji="🎯"
            label="Попал — стреляй ещё"
            hint="классическое правило дополнительного выстрела"
            value={settings.extraTurnOnHit}
            onChange={(v) => setSettings({ extraTurnOnHit: v })}
          />
          <Toggle
            emoji="📐"
            label="Корабли могут касаться"
            hint="выключено — вокруг корабля всегда есть вода"
            value={settings.allowTouching}
            onChange={(v) => setSettings({ allowTouching: v })}
          />
          <Toggle
            emoji="🎖️"
            label="Способности и энергия"
            hint="радар, торпеда, мины, дымовая завеса"
            value={settings.abilities}
            onChange={(v) => setSettings({ abilities: v })}
          />
          <Toggle
            emoji="💡"
            label="Подсказки"
            hint="«горячо — холодно» после промаха"
            value={settings.hints}
            onChange={(v) => setSettings({ hints: v })}
          />
          <div className="divider" />
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

        {draft.some((p) => p.isBot) && (
          <>
            <SectionTitle>Сила ботов</SectionTitle>
            <div className="card stack">
              <Segmented
                value={settings.botLevel}
                onChange={(v) => setSettings({ botLevel: v })}
                options={BOT_LEVELS.map((b) => ({ value: b.id, label: b.name, emoji: b.emoji }))}
              />
              <div className="setting-hint">
                {BOT_LEVELS.find((b) => b.id === settings.botLevel)?.description}
              </div>
            </div>
          </>
        )}
      </div>

      <button
        className="btn primary block"
        disabled={!enough}
        onClick={() => {
          tap('select');
          startGame();
        }}
      >
        К расстановке →
      </button>
    </Screen>
  );
}

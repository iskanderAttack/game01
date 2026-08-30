import { useEffect } from 'react';
import { useApp } from '../../store/appStore';
import { getMode } from '../../game/modes';
import { BOT_LEVELS } from '../../game/bots';
import { money } from '../../game/money';
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
      <TopBar title={`${mode.emoji} ${mode.name}`} subtitle={mode.tagline} onBack={() => go('modes')} />

      <div className="scroll">
        <SectionTitle>Кто играет</SectionTitle>
        <div className="players-list">
          {draft.map((p) => (
            <div key={p.id} className="player-row card" style={{ padding: 11 }}>
              <Avatar emoji={p.emoji} color={p.color} size={38} />
              <div className="grow">
                <div className="player-name">{p.name}</div>
                <div className="player-sub">
                  {p.isBot
                    ? `🤖 ${BOT_LEVELS.find((b) => b.id === p.botLevel)?.name ?? 'бот'}`
                    : '📱 это устройство'}
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
          <button className="btn grow" disabled={draft.length >= mode.maxPlayers} onClick={() => { tap(); addHuman(); }}>
            + Игрок
          </button>
          <button className="btn grow" disabled={draft.length >= mode.maxPlayers} onClick={() => { tap(); addBot(); }}>
            + Бот
          </button>
        </div>

        {!enough && (
          <div className="notice warn">
            Нужно от {mode.minPlayers} до {mode.maxPlayers} участников.
          </div>
        )}
        {humans > 1 && (
          <div className="notice">
            Несколько живых игроков на одном устройстве ходят по очереди, передавая телефон.
            Чтобы каждый играл со своего — вернитесь и выберите «Играть по Wi-Fi».
          </div>
        )}

        <SectionTitle>Деньги</SectionTitle>
        <div className="card stack">
          <Stepper
            emoji="💰"
            label="Стартовый капитал"
            value={settings.startMoney}
            min={500000}
            max={5000000}
            step={100000}
            onChange={(v) => setSettings({ startMoney: v })}
            format={(v) => money(v)}
          />
          <Stepper
            emoji="🏁"
            label="Выплата за «Старт»"
            value={settings.goSalary}
            min={50000}
            max={500000}
            step={50000}
            onChange={(v) => setSettings({ goSalary: v })}
            format={(v) => money(v)}
          />
          <Toggle
            emoji="🎯"
            label="Двойная выплата за точный «Старт»"
            hint="популярное домашнее правило"
            value={settings.goBonus}
            onChange={(v) => setSettings({ goBonus: v })}
          />
          <Toggle
            emoji="🅿️"
            label="Куш на «Бесплатной стоянке»"
            hint="налоги и штрафы копятся и достаются тому, кто попадёт"
            value={settings.parkingPot}
            onChange={(v) => setSettings({ parkingPot: v })}
          />
        </div>

        <SectionTitle>Правила</SectionTitle>
        <div className="card stack">
          <Toggle
            emoji="🔨"
            label="Аукцион при отказе"
            hint="классическое правило: отказался — участок уходит с торгов"
            value={settings.auctions}
            onChange={(v) => setSettings({ auctions: v })}
          />
          <Toggle
            emoji="🏦"
            label="Залог участков"
            hint="можно заложить участок банку за половину цены"
            value={settings.mortgages}
            onChange={(v) => setSettings({ mortgages: v })}
          />
          <Toggle
            emoji="📐"
            label="Равномерная застройка"
            hint="нельзя строить второй дом, пока в группе не стоит по одному"
            value={settings.evenBuild}
            onChange={(v) => setSettings({ evenBuild: v })}
          />
          <Toggle
            emoji="🏙️"
            label="Небоскрёбы и кредиты"
            hint="режим большого развития поверх отелей"
            value={settings.tycoon}
            onChange={(v) => setSettings({ tycoon: v })}
          />
          <div className="divider" />
          <Stepper
            emoji="🔁"
            label="Лимит кругов"
            value={settings.roundLimit}
            min={0}
            max={30}
            onChange={(v) => setSettings({ roundLimit: v })}
            format={(v) => (v === 0 ? 'до победы' : `${v}`)}
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
        Начать партию
      </button>
    </Screen>
  );
}

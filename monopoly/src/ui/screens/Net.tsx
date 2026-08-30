import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../store/appStore';
import { GAME_MODES, getMode } from '../../game/modes';
import { money } from '../../game/money';
import { useHost, startHosting, stopHosting, syncLobby } from '../../net/host';
import { useClient, connectToRoom, disconnect, startScanning, stopScanning } from '../../net/client';
import { DEFAULT_PORT } from '../../net/protocol';
import { canHostNatively } from '../../net/plugin';
import { Screen, TopBar } from '../components/Shell';
import { Segmented, Stepper } from '../components/controls';
import { Avatar } from '../components/PlayerBits';
import { tap } from '../../lib/feedback';

type Tab = 'host' | 'join';

export function NetScreen() {
  const go = useApp((s) => s.go);
  const host = useHost();
  const client = useClient();
  const [tab, setTab] = useState<Tab>('host');

  // Выходя с экрана, гасим и комнату, и сканирование.
  useEffect(() => {
    return () => {
      void stopScanning();
    };
  }, []);

  const leave = () => {
    tap();
    if (host.active) void stopHosting();
    if (client.status !== 'idle') disconnect();
    go('home');
  };

  return (
    <Screen name="net">
      <TopBar
        title="Игра по Wi-Fi"
        subtitle="Все телефоны в одной сети Wi-Fi"
        onBack={leave}
      />

      {!host.active && client.status === 'idle' && (
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'host', label: 'Создать', emoji: '📡' },
            { value: 'join', label: 'Подключиться', emoji: '🔎' },
          ]}
        />
      )}

      <div className="scroll">
        {host.active ? (
          <HostLobby />
        ) : client.status !== 'idle' ? (
          <ClientSide />
        ) : tab === 'host' ? (
          <HostSetup />
        ) : (
          <JoinSide />
        )}
      </div>
    </Screen>
  );
}

/* ───────────────────────────── создание ───────────────────────────── */

function HostSetup() {
  const settings = useApp((s) => s.settings);
  const setMode = useApp((s) => s.setMode);
  const setSettings = useApp((s) => s.setSettings);
  const profile = useApp((s) => s.profile);
  const resetDraft = useApp((s) => s.resetDraft);
  const addHuman = useApp((s) => s.addHuman);
  const error = useHost((s) => s.error);
  const [busy, setBusy] = useState(false);

  const mode = getMode(settings.modeId);
  const netModes = GAME_MODES;

  const open = async () => {
    tap('select');
    setBusy(true);
    resetDraft();
    addHuman(profile.name);
    await startHosting(`Комната ${profile.name}`);
    setBusy(false);
  };

  return (
    <>
      <div className="card net-hero">
        <span className="net-emoji">📡</span>
        <div>
          <div className="net-title">Ваш телефон станет столом</div>
          <p className="muted" style={{ fontSize: 13.5 }}>
            {canHostNatively()
              ? 'Остальные найдут её сами, без ввода адресов.'
              : 'В браузере комнату держит вспомогательный сервер на компьютере: запустите «npm run lan». В APK всё работает без него.'}
          </p>
        </div>
      </div>

      <span className="label">Режим</span>
      <div className="mode-strip">
        {netModes.map((m) => (
          <button
            key={m.id}
            className={`mode-pill ${settings.modeId === m.id ? 'on' : ''}`}
            onClick={() => {
              tap('select');
              setMode(m.id);
            }}
          >
            <span>{m.emoji}</span>
            <b>{m.name}</b>
          </button>
        ))}
      </div>
      <div className="setting-hint">{mode.tagline}</div>

      <div className="card">
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
      </div>

      {error && <div className="notice warn">{error}</div>}

      <button className="btn primary block" disabled={busy} onClick={() => void open()}>
        {busy ? 'Открываем…' : 'Открыть комнату'}
      </button>
    </>
  );
}

function HostLobby() {
  const host = useHost();
  const settings = useApp((s) => s.settings);
  const draft = useApp((s) => s.draft);
  const addBot = useApp((s) => s.addBot);
  const removePlayer = useApp((s) => s.removePlayer);
  const startGame = useApp((s) => s.startGame);
  const mode = getMode(settings.modeId);
  const enough = draft.length >= mode.minPlayers;

  useEffect(() => {
    syncLobby();
  }, [draft.length, settings.modeId]);

  return (
    <>
      <motion.div className="card" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <span className="label">Код комнаты</span>
        <div className="room-code mono">{host.code}</div>
        <div className="room-addr mono">
          {host.ip}:{host.port}
        </div>
        <div className="wrap" style={{ marginTop: 12, justifyContent: 'center' }}>
          <span className="chip on">
            {host.transport === 'native' ? '📡 прямое Wi-Fi' : '🖥️ через ретранслятор'}
          </span>
          <span className="chip">
            {mode.emoji} {mode.name}
          </span>
          <span className="chip">💰 {money(settings.startMoney)}</span>
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          {canHostNatively()
            ? 'На других телефонах откройте «По Wi-Fi → Подключиться» — комната появится в списке сама.'
            : `Друзья заходят на страницу игры и вводят адрес ${host.ip}:${host.port} с кодом ${host.code}.`}
        </p>
      </motion.div>

      <span className="label">В комнате {draft.length} / {mode.maxPlayers}</span>
      <div className="players-list">
        {draft.map((p, i) => (
          <motion.div key={p.id} layout className="player-row card" style={{ padding: 11 }}>
            <Avatar emoji={p.emoji} color={p.color} size={38} />
            <div className="grow">
              <div className="player-name">
                {p.name}
                {i === 0 && <span className="chip" style={{ marginLeft: 6 }}>хост</span>}
              </div>
              <div className="player-sub">
                {p.isBot ? '🤖 бот' : p.remote ? (p.connected ? '📶 на связи' : '⚠️ отвалился') : '📱 это устройство'}
              </div>
            </div>
            {(p.isBot || p.remote) && (
              <button
                className="icon-btn small-icon"
                onClick={() => {
                  tap();
                  removePlayer(p.id);
                }}
              >
                ✕
              </button>
            )}
          </motion.div>
        ))}
      </div>

      <div className="row">
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
        <button
          className="btn grow danger"
          onClick={() => {
            tap();
            void stopHosting();
          }}
        >
          Закрыть комнату
        </button>
      </div>

      {!enough && (
        <div className="notice">Ждём игроков: нужно минимум {mode.minPlayers}.</div>
      )}

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
    </>
  );
}

/* ───────────────────────────── подключение ───────────────────────────── */

function JoinSide() {
  const client = useClient();
  const [ip, setIp] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    void startScanning();
    return () => {
      void stopScanning();
    };
  }, []);

  return (
    <>
      <div className="card net-hero">
        <span className="net-emoji">🔎</span>
        <div>
          <div className="net-title">Ищем комнаты рядом</div>
          <p className="muted" style={{ fontSize: 13.5 }}>
            {canHostNatively()
              ? 'Комнаты в вашей сети появятся здесь сами.'
              : 'В браузере список комнат приходит от вспомогательного сервера. Либо введите адрес вручную.'}
          </p>
        </div>
      </div>

      <div className="row between">
        <span className="label">Найдено комнат: {client.rooms.length}</span>
        {client.scanning && <span className="chip pulse">сканируем…</span>}
      </div>

      <div className="stack">
        {client.rooms.map((r) => (
          <button
            key={`${r.ip}:${r.port}:${r.code}`}
            className="room-found"
            onClick={() => {
              tap('select');
              connectToRoom(r.ip, r.port, r.code);
            }}
          >
            <span className="room-found-emoji">🎩</span>
            <div className="grow" style={{ textAlign: 'left' }}>
              <div className="player-name">{r.room}</div>
              <div className="player-sub">
                {r.mode} · {r.players} в комнате · {r.ip}
              </div>
            </div>
            <span className="chip on mono">{r.code}</span>
          </button>
        ))}
        {client.rooms.length === 0 && (
          <div className="card center" style={{ padding: 26 }}>
            <div className="shimmer" style={{ fontSize: 34 }}>📡</div>
            <div className="muted" style={{ marginTop: 10 }}>
              Пока пусто. Попросите хоста открыть комнату.
            </div>
          </div>
        )}
      </div>

      <div className="card stack">
        <span className="label">Вручную</span>
        <input
          className="field"
          placeholder="IP хоста, например 192.168.1.42"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          inputMode="decimal"
        />
        <input
          className="field"
          placeholder="Код комнаты (для режима через компьютер)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={4}
        />
        <button
          className="btn primary block"
          disabled={!ip.trim()}
          onClick={() => {
            tap('select');
            connectToRoom(ip.trim(), DEFAULT_PORT, code.trim());
          }}
        >
          Подключиться
        </button>
      </div>

      {client.error && <div className="notice warn">{client.error}</div>}
    </>
  );
}

function ClientSide() {
  const client = useClient();
  const profile = useApp((s) => s.profile);

  if (client.status === 'error' || client.status === 'closed') {
    return (
      <div className="card center" style={{ padding: 30 }}>
        <div style={{ fontSize: 40 }}>🌊</div>
        <div className="net-title" style={{ marginTop: 10 }}>
          {client.status === 'closed' ? 'Комната закрыта' : 'Не удалось подключиться'}
        </div>
        <p className="muted" style={{ marginTop: 6 }}>{client.error}</p>
        <button className="btn block" style={{ marginTop: 18 }} onClick={() => disconnect(false)}>
          Назад
        </button>
      </div>
    );
  }

  if (client.status === 'connecting') {
    return (
      <div className="card center" style={{ padding: 40 }}>
        <motion.div
          style={{ fontSize: 42 }}
          animate={{ rotate: [0, 12, -12, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          🧭
        </motion.div>
        <div className="net-title" style={{ marginTop: 14 }}>Подключаемся…</div>
        <p className="muted">{client.error ?? 'Ищем комнату в сети'}</p>
      </div>
    );
  }

  return (
    <>
      <div className="card center" style={{ padding: 24 }}>
        <Avatar emoji={profile.emoji} color={profile.color} size={54} />
        <div className="net-title" style={{ marginTop: 12 }}>Вы в комнате</div>
        <div className="muted">{client.room}</div>
      </div>

      <span className="label">Участники</span>
      <div className="players-list">
        {client.members.map((m) => (
          <motion.div key={m.id} layout className="player-row card" style={{ padding: 11 }}>
            <Avatar emoji={m.emoji} color={m.color} size={36} />
            <div className="grow">
              <div className="player-name">
                {m.name}
                {m.id === client.playerId && <span className="chip" style={{ marginLeft: 6 }}>вы</span>}
                {m.isHost && <span className="chip" style={{ marginLeft: 6 }}>хост</span>}
              </div>
              <div className="player-sub">
                {m.isBot ? '🤖 бот' : m.connected ? '📶 на связи' : '⚠️ отвалился'}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="waiting-hint">Ждём, когда хост начнёт партию…</div>

      <button className="btn block" onClick={() => { tap(); disconnect(); }}>
        Выйти из комнаты
      </button>
    </>
  );
}

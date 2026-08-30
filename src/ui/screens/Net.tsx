import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../store/appStore';
import { useHost, startHosting, stopHosting, syncLobby } from '../../net/host';
import {
  useClient,
  connectToRoom,
  disconnect,
  startScanning,
  stopScanning,
  supportsNativeLan,
} from '../../net/client';
import { DEFAULT_PORT, RELAY_PORT } from '../../net/protocol';
import { GAME_MODES, getMode } from '../../game/modes';
import { Screen, TopBar, SectionTitle } from '../components/Shell';
import { Segmented, Stepper } from '../components/controls';
import { Avatar } from '../components/PlayerBits';
import { tap } from '../../lib/feedback';

export function NetScreen() {
  const go = useApp((s) => s.go);
  const [tab, setTab] = useState<'host' | 'join'>('host');
  const host = useHost();
  const client = useClient();

  useEffect(() => {
    if (tab === 'join' && client.status === 'idle') void startScanning();
    return () => {
      void stopScanning();
    };
  }, [tab, client.status]);

  return (
    <Screen>
      <TopBar
        title="Игра по Wi-Fi"
        subtitle="Все устройства должны быть в одной сети"
        onBack={() => {
          if (host.active) void stopHosting();
          if (client.status !== 'idle') disconnect();
          go('home');
        }}
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
          <ClientLobby />
        ) : tab === 'host' ? (
          <HostSetup />
        ) : (
          <JoinPanel />
        )}
      </div>
    </Screen>
  );
}

/* ───────────────────────────── создание ───────────────────────────── */

function HostSetup() {
  const settings = useApp((s) => s.settings);
  const chooseModeOnly = useApp((s) => s.setSettings);
  const ensure = useApp((s) => s.ensureMinimumPlayers);
  const draft = useApp((s) => s.draft);
  const profile = useApp((s) => s.profile);
  const error = useHost((s) => s.error);
  const [busy, setBusy] = useState(false);
  const native = supportsNativeLan();

  const open = async () => {
    tap('select');
    setBusy(true);
    // Хост занимает первое место в комнате.
    if (draft.length === 0) useApp.setState({ draft: [] });
    useApp.setState({ draft: [] });
    useApp.getState().addHuman(profile.name);
    await startHosting(`Комната ${profile.name}`);
    setBusy(false);
  };

  const availableModes = GAME_MODES.filter((m) => m.id !== 'solo' && m.maxPlayers >= 2);

  return (
    <>
      <div className="card net-hero">
        <span className="net-emoji">📡</span>
        <div>
          <div className="net-title">Ваш телефон станет комнатой</div>
          <p className="muted" style={{ fontSize: 13.5 }}>
            {native
              ? 'Остальные увидят её в списке автоматически — интернет не нужен, только общий Wi-Fi.'
              : 'В браузере комнату держит вспомогательный сервер на компьютере: запустите «npm run lan». В APK всё работает без него.'}
          </p>
        </div>
      </div>

      <SectionTitle>Режим</SectionTitle>
      <div className="mode-strip">
        {availableModes.map((m) => (
          <button
            key={m.id}
            className={`mode-pill ${settings.modeId === m.id ? 'on' : ''}`}
            style={{ ['--card-accent' as string]: m.accent }}
            onClick={() => {
              tap('select');
              chooseModeOnly({ modeId: m.id, ...m.defaults });
            }}
          >
            <span>{m.emoji}</span>
            <b>{m.name}</b>
          </button>
        ))}
      </div>
      <div className="setting-hint">{getMode(settings.modeId).tagline}</div>

      <div className="card">
        <Stepper
          emoji="🔁"
          label="Раундов"
          value={settings.rounds}
          min={3}
          max={40}
          onChange={(v) => chooseModeOnly({ rounds: v })}
        />
      </div>

      {error && <div className="notice warn">{error}</div>}

      <button className="btn primary block" disabled={busy} onClick={open}>
        {busy ? 'Открываем…' : 'Открыть комнату'}
      </button>
    </>
  );
}

function HostLobby() {
  const host = useHost();
  const draft = useApp((s) => s.draft);
  const settings = useApp((s) => s.settings);
  const addBot = useApp((s) => s.addBot);
  const removePlayer = useApp((s) => s.removePlayer);
  const startGame = useApp((s) => s.startGame);
  const mode = getMode(settings.modeId);
  const enough = draft.length >= mode.minPlayers;

  useEffect(() => {
    syncLobby();
  }, [draft.length, settings.modeId, settings.rounds]);

  return (
    <>
      <motion.div className="card room-card" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <span className="label">Код комнаты</span>
        <div className="room-code mono">{host.code}</div>
        <div className="room-addr mono">
          {host.ip}:{host.port}
        </div>
        <div className="wrap" style={{ marginTop: 12, justifyContent: 'center' }}>
          <span className="chip on">{host.transport === 'native' ? '📡 прямое Wi-Fi' : '🖥️ через ретранслятор'}</span>
          <span className="chip">{mode.emoji} {mode.name}</span>
          <span className="chip">🔁 {settings.rounds}</span>
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          {host.transport === 'native'
            ? 'Пусть друзья откроют «По Wi-Fi → Подключиться» — комната появится в списке сама.'
            : `Друзья заходят на страницу игры и вводят адрес ${host.ip}:${RELAY_PORT} с кодом ${host.code}.`}
        </p>
      </motion.div>

      <SectionTitle hint={`${draft.length} / ${mode.maxPlayers}`}>В комнате</SectionTitle>
      <div className="players-list">
        <AnimatePresence initial={false}>
          {draft.map((p, i) => (
            <motion.div
              key={p.id}
              layout
              className="player-row card"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Avatar player={p} size={40} />
              <div className="grow">
                <div className="player-name">
                  {p.name} {i === 0 && <span className="chip" style={{ marginLeft: 6 }}>хост</span>}
                </div>
                <div className="player-sub">
                  {p.isBot ? '🤖 бот' : p.remote ? (p.connected ? '📶 подключён' : '⚠️ отвалился') : '📱 это устройство'}
                </div>
              </div>
              {i > 0 && (
                <button className="icon-btn small-icon" onClick={() => { tap(); removePlayer(p.id); }}>
                  ✕
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="row">
        <button
          className="btn grow"
          disabled={draft.length >= mode.maxPlayers}
          onClick={() => {
            tap('select');
            addBot();
          }}
        >
          + Бот
        </button>
        <button
          className="btn grow"
          onClick={() => {
            tap();
            void stopHosting();
          }}
        >
          Закрыть комнату
        </button>
      </div>

      {!enough && <div className="notice">Ждём игроков: нужно минимум {mode.minPlayers}.</div>}

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

/* ─────────────────────────── подключение ──────────────────────────── */

function JoinPanel() {
  const client = useClient();
  const [ip, setIp] = useState('');
  const [code, setCode] = useState('');
  const native = supportsNativeLan();

  return (
    <>
      <div className="card net-hero">
        <span className="net-emoji">🔎</span>
        <div>
          <div className="net-title">Ищем комнаты рядом</div>
          <p className="muted" style={{ fontSize: 13.5 }}>
            {native
              ? 'Комнаты в вашей Wi-Fi сети находятся автоматически. Если сеть блокирует рассылку — введите адрес вручную.'
              : 'В браузере список комнат приходит от вспомогательного сервера. Либо введите адрес вручную.'}
          </p>
        </div>
      </div>

      <div className="row between">
        <span className="label">Найдено комнат: {client.rooms.length}</span>
        {client.scanning && <span className="chip pulse">сканируем…</span>}
      </div>

      <div className="stack">
        <AnimatePresence initial={false}>
          {client.rooms.map((r) => (
            <motion.button
              key={`${r.ip}:${r.port}:${r.code}`}
              layout
              className="card room-found"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                tap('select');
                connectToRoom(r.ip, r.port, r.code);
              }}
            >
              <span className="room-found-emoji">🏠</span>
              <div className="grow" style={{ textAlign: 'left' }}>
                <div className="player-name">{r.room}</div>
                <div className="player-sub">
                  {r.mode} · {r.players} в комнате · {r.ip}
                </div>
              </div>
              <span className="chip on mono">{r.code}</span>
            </motion.button>
          ))}
        </AnimatePresence>
        {client.rooms.length === 0 && (
          <div className="card center" style={{ padding: 26 }}>
            <div className="shimmer" style={{ fontSize: 34 }}>📡</div>
            <div className="muted" style={{ marginTop: 10 }}>
              Пока пусто. Пусть кто-нибудь откроет комнату.
            </div>
          </div>
        )}
      </div>

      <SectionTitle>Вручную</SectionTitle>
      <div className="card stack">
        <input
          type="text"
          inputMode="decimal"
          placeholder={`IP хоста, например 192.168.1.42`}
          value={ip}
          onChange={(e) => setIp(e.target.value.trim())}
        />
        <input
          type="text"
          placeholder="Код комнаты (для режима через компьютер)"
          value={code}
          maxLength={6}
          onChange={(e) => setCode(e.target.value.toUpperCase().trim())}
        />
        <button
          className="btn primary block"
          disabled={!ip}
          onClick={() => {
            tap('select');
            connectToRoom(ip, code ? RELAY_PORT : DEFAULT_PORT, code);
          }}
        >
          Подключиться
        </button>
      </div>

      {client.error && <div className="notice warn">{client.error}</div>}
    </>
  );
}

function ClientLobby() {
  const client = useClient();
  const profile = useApp((s) => s.profile);

  if (client.status === 'error' || client.status === 'closed') {
    return (
      <div className="card center" style={{ padding: 30 }}>
        <div style={{ fontSize: 40 }}>😕</div>
        <div className="net-title" style={{ marginTop: 10 }}>
          {client.status === 'closed' ? 'Комната закрыта' : 'Не получилось'}
        </div>
        <p className="muted" style={{ marginTop: 6 }}>{client.error}</p>
        <button className="btn block" style={{ marginTop: 18 }} onClick={() => disconnect(false)}>
          Назад к поиску
        </button>
      </div>
    );
  }

  if (client.status === 'connecting') {
    return (
      <div className="card center" style={{ padding: 40 }}>
        <motion.div
          style={{ fontSize: 44 }}
          animate={{ rotate: [0, 12, -12, 0] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          📶
        </motion.div>
        <div className="net-title" style={{ marginTop: 14 }}>Подключаемся…</div>
        <p className="muted">{client.error ?? 'Ищем комнату в сети'}</p>
      </div>
    );
  }

  return (
    <>
      <div className="card center" style={{ padding: 24 }}>
        <Avatar player={{ emoji: profile.emoji, color: profile.color, isBot: false }} size={64} />
        <div className="net-title" style={{ marginTop: 12 }}>Вы в комнате</div>
        <div className="muted">{client.room}</div>
      </div>

      <SectionTitle>Участники</SectionTitle>
      <div className="players-list">
        {client.members.map((m) => (
          <motion.div key={m.id} layout className="player-row card">
            <Avatar player={{ emoji: m.emoji, color: m.color, isBot: m.isBot }} size={40} />
            <div className="grow">
              <div className="player-name">
                {m.name}
                {m.id === client.playerId && <span className="chip" style={{ marginLeft: 6 }}>вы</span>}
                {m.isHost && <span className="chip" style={{ marginLeft: 6 }}>хост</span>}
              </div>
              <div className="player-sub">{m.isBot ? '🤖 бот' : m.connected ? '📶 на связи' : '⚠️ отвалился'}</div>
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

import { create } from 'zustand';
import { useApp } from '../store/appStore';
import { makePlayer } from '../game/engine';
import { getMode } from '../game/modes';
import { avatarFor } from '../game/avatars';
import { createHostTransport, type HostTransport } from './transport';
import {
  APP_TAG,
  DEFAULT_PORT,
  DISCOVERY_PORT,
  PROTOCOL_VERSION,
  decode,
  encode,
  makeRoomCode,
  type ClientMessage,
  type HostMessage,
  type LobbyMember,
} from './protocol';
import { Lan, canHostNatively } from './plugin';
import { play } from '../lib/feedback';
import { diag } from '../lib/diag';
import type { GameState } from '../game/types';

interface HostStore {
  active: boolean;
  room: string;
  code: string;
  ip: string;
  port: number;
  transport: 'native' | 'relay' | null;
  error: string | null;
  members: LobbyMember[];
  /** clientId → playerId. Живёт ровно столько, сколько сокет. */
  seats: Record<string, string>;
  /**
   * session → playerId. Переживает обрыв связи, поэтому вернувшийся игрок
   * садится на своё прежнее место, а не получает «Партия уже идёт».
   */
  seatsBySession: Record<string, string>;
  /** playerId игроков, за которых пока играет бот. */
  botStandIns: string[];
}

export const useHost = create<HostStore>(() => ({
  active: false,
  room: '',
  code: '',
  ip: '',
  port: DEFAULT_PORT,
  transport: null,
  error: null,
  members: [],
  seats: {},
  seatsBySession: {},
  botStandIns: [],
}));

let transport: HostTransport | null = null;
let unsubscribe: (() => void) | null = null;
let advertiseTimer: ReturnType<typeof setInterval> | null = null;
let lastGame: GameState | null = null;

function lobbyMembers(): LobbyMember[] {
  return useApp.getState().draft.map((p, i) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    color: p.color,
    isBot: p.isBot,
    connected: p.connected !== false,
    isHost: i === 0,
  }));
}

function pushLobby() {
  const { settings } = useApp.getState();
  const members = lobbyMembers();
  useHost.setState({ members });
  broadcast({ t: 'lobby', members, settings, room: useHost.getState().room });
}

function broadcast(msg: HostMessage) {
  transport?.broadcast(encode(msg));
}

function sendTo(clientId: string, msg: HostMessage) {
  transport?.send(clientId, encode(msg));
}

function advertisePayload() {
  const h = useHost.getState();
  const app = useApp.getState();
  return JSON.stringify({
    app: APP_TAG,
    version: PROTOCOL_VERSION,
    room: h.room,
    code: h.code,
    host: app.profile.name,
    ip: h.ip,
    port: h.port,
    players: app.draft.length,
    mode: getMode(app.settings.modeId).name,
  });
}

function handleClientMessage(clientId: string, raw: string) {
  const msg = decode<ClientMessage>(raw);
  if (!msg) return;
  const app = useApp.getState();
  const host = useHost.getState();

  if (msg.t === 'join') {
    if (msg.version !== PROTOCOL_VERSION) {
      sendTo(clientId, { t: 'reject', reason: 'Разные версии игры — обновите приложение' });
      return;
    }
    const session = msg.session || clientId;

    const existing = host.seats[clientId];
    if (existing) {
      sendTo(clientId, { t: 'welcome', playerId: existing, room: host.room, version: PROTOCOL_VERSION });
      pushLobby();
      if (app.game) sendTo(clientId, { t: 'state', game: app.game });
      return;
    }

    // Игрок вернулся после обрыва — сажаем на прежнее место.
    const known = host.seatsBySession[session];
    if (known) {
      useHost.setState({ seats: { ...host.seats, [clientId]: known } });
      reconnectPlayer(known);
      sendTo(clientId, { t: 'welcome', playerId: known, room: host.room, version: PROTOCOL_VERSION });
      diag('сеть', `вернулся ${known}`);
      pushLobby();
      const game = useApp.getState().game;
      if (game) sendTo(clientId, { t: 'state', game });
      return;
    }

    if (app.game) {
      sendTo(clientId, { t: 'reject', reason: 'Партия уже идёт' });
      return;
    }
    const mode = getMode(app.settings.modeId);
    if (app.draft.length >= mode.maxPlayers) {
      sendTo(clientId, { t: 'reject', reason: 'В комнате нет свободных мест' });
      return;
    }

    const av = avatarFor(app.draft.length);
    const player = makePlayer({
      id: `net-${clientId}`,
      name: msg.name?.slice(0, 14) || `Гость ${app.draft.length + 1}`,
      emoji: msg.emoji || av.emoji,
      color: msg.color || av.color,
      isBot: false,
      remote: true,
      connected: true,
    });
    useApp.setState({ draft: [...app.draft, player] });
    useHost.setState({
      seats: { ...host.seats, [clientId]: player.id },
      seatsBySession: { ...host.seatsBySession, [session]: player.id },
    });
    sendTo(clientId, { t: 'welcome', playerId: player.id, room: host.room, version: PROTOCOL_VERSION });
    play('turn');
    diag('сеть', `подключился ${player.name}`);
    pushLobby();
    void advertise();
    return;
  }

  const playerId = host.seats[clientId];
  if (!playerId) return;

  if (msg.t === 'act') {
    // Хост — единственный судья: действие проходит через тот же движок.
    const error = useApp.getState().applyLocal(playerId, msg.action);
    if (error) sendTo(clientId, { t: 'error', text: error });
    return;
  }

  if (msg.t === 'leave') {
    dropClient(clientId, true);
    return;
  }

  if (msg.t === 'ping') sendTo(clientId, { t: 'pong' });
}

/**
 * Игрок вернулся: снимаем метку «не на связи» и, если за него уже доигрывал
 * бот, возвращаем управление человеку.
 */
function reconnectPlayer(playerId: string) {
  const app = useApp.getState();
  const host = useHost.getState();
  const standIn = host.botStandIns.includes(playerId);

  if (app.game) {
    useApp.setState({
      game: {
        ...app.game,
        players: app.game.players.map((p) =>
          p.id === playerId ? { ...p, connected: true, isBot: standIn ? false : p.isBot } : p,
        ),
      },
    });
  } else {
    useApp.setState({
      draft: app.draft.map((p) => (p.id === playerId ? { ...p, connected: true } : p)),
    });
  }

  if (standIn) {
    useHost.setState({ botStandIns: host.botStandIns.filter((id) => id !== playerId) });
  }
}

/**
 * Отдать ход отключившегося игрока боту, чтобы стол не стоял.
 * Как только человек вернётся, управление вернётся ему само.
 */
export function handOverToBot(playerId: string) {
  const app = useApp.getState();
  if (!app.game) return;
  const host = useHost.getState();
  if (host.botStandIns.includes(playerId)) return;

  useApp.setState({
    game: {
      ...app.game,
      players: app.game.players.map((p) =>
        p.id === playerId ? { ...p, isBot: true, botLevel: p.botLevel ?? 'normal' } : p,
      ),
    },
  });
  useHost.setState({ botStandIns: [...host.botStandIns, playerId] });
  diag('сеть', `за ${playerId} доигрывает бот`);
  // Разбудить очередь ботов на новом состоянии.
  useApp.getState().nudgeBots();
}

function dropClient(clientId: string, explicit = false) {
  const host = useHost.getState();
  const playerId = host.seats[clientId];
  if (!playerId) return;
  const app = useApp.getState();

  const seats = { ...host.seats };
  delete seats[clientId];

  if (!app.game) {
    const seatsBySession = { ...host.seatsBySession };
    for (const [session, id] of Object.entries(seatsBySession)) {
      if (id === playerId) delete seatsBySession[session];
    }
    useApp.setState({ draft: app.draft.filter((p) => p.id !== playerId) });
    useHost.setState({ seats, seatsBySession });
    pushLobby();
    void advertise();
    return;
  }

  useApp.setState({
    game: {
      ...app.game,
      players: app.game.players.map((p) => (p.id === playerId ? { ...p, connected: false } : p)),
    },
  });

  // Место в `seatsBySession` остаётся: по нему игрок вернётся в партию.
  // Привязка к сокету не нужна — сокета больше нет.
  useHost.setState({ seats });
  if (explicit) {
    const seatsBySession = { ...host.seatsBySession };
    for (const [session, id] of Object.entries(seatsBySession)) {
      if (id === playerId) delete seatsBySession[session];
    }
    useHost.setState({ seatsBySession });
  }
  diag('сеть', `отключился ${playerId}`);
  pushLobby();
}

async function advertise() {
  await transport?.advertise(advertisePayload()).catch(() => {});
}

export async function startHosting(roomName: string): Promise<void> {
  if (useHost.getState().active) return;
  const code = makeRoomCode();
  const room = roomName || `Комната ${code}`;
  useHost.setState({ room, code, error: null });

  transport = createHostTransport(code);
  transport.setHandlers({
    onConnect: () => {},
    onDisconnect: (id) => dropClient(id),
    onMessage: handleClientMessage,
  });

  try {
    const { ip, port } = await transport.start(DEFAULT_PORT);
    useHost.setState({ active: true, ip, port, transport: transport.kind });
  } catch (e) {
    useHost.setState({ error: e instanceof Error ? e.message : 'Не удалось открыть комнату' });
    transport = null;
    return;
  }

  if (canHostNatively()) {
    await Lan.startAdvertise({ payload: advertisePayload(), port: DISCOVERY_PORT }).catch(() => {});
  }
  advertiseTimer = setInterval(() => void advertise(), 2000);

  useApp.getState().setNetRole('host', useApp.getState().draft[0]?.id ?? null);
  pushLobby();

  unsubscribe = useApp.subscribe((s) => {
    if (s.game !== lastGame) {
      lastGame = s.game;
      if (s.game) broadcast({ t: 'state', game: s.game });
    }
  });
}

export async function stopHosting(reason = 'Хост закрыл комнату') {
  if (!useHost.getState().active) return;
  broadcast({ t: 'closed', reason });
  unsubscribe?.();
  unsubscribe = null;
  if (advertiseTimer) clearInterval(advertiseTimer);
  advertiseTimer = null;
  await transport?.stop();
  transport = null;
  useHost.setState({
    active: false,
    members: [],
    seats: {},
    seatsBySession: {},
    botStandIns: [],
    ip: '',
    transport: null,
  });
  useApp.getState().setNetRole('local', null);
}

/** Синхронизировать лобби после изменений на стороне хоста. */
export function syncLobby() {
  if (useHost.getState().active) {
    pushLobby();
    void advertise();
  }
}

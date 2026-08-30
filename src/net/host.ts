import { create } from 'zustand';
import { useApp } from '../store/appStore';
import { makePlayer } from '../game/engine';
import { getMode } from '../game/modes';
import { avatarFor } from '../game/avatars';
import { createHostTransport, type HostTransport } from './transport';
import {
  DEFAULT_PORT,
  PROTOCOL_VERSION,
  encode,
  decode,
  makeRoomCode,
  type ClientMessage,
  type HostMessage,
  type LobbyMember,
} from './protocol';
import { Lan, canHostNatively } from './plugin';
import { play } from '../lib/feedback';

interface HostStore {
  active: boolean;
  room: string;
  code: string;
  ip: string;
  port: number;
  transport: 'native' | 'relay' | null;
  error: string | null;
  members: LobbyMember[];
  /** clientId → playerId */
  seats: Record<string, string>;
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
}));

let transport: HostTransport | null = null;
let unsubscribe: (() => void) | null = null;
let advertiseTimer: ReturnType<typeof setInterval> | null = null;
let lastGame: unknown = null;
let lastReveal: unknown = null;

function lobbyMembers(): LobbyMember[] {
  const { draft } = useApp.getState();
  return draft.map((p, i) => ({
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
    app: 'pd',
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

/** Подключившийся, но ещё не занявший место игрок. */
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
    if (app.game) {
      sendTo(clientId, { t: 'reject', reason: 'Партия уже идёт' });
      return;
    }
    const mode = getMode(app.settings.modeId);
    if (app.draft.length >= mode.maxPlayers) {
      sendTo(clientId, { t: 'reject', reason: 'В комнате нет свободных мест' });
      return;
    }
    const existing = host.seats[clientId];
    if (existing) {
      sendTo(clientId, { t: 'welcome', playerId: existing, room: host.room, version: PROTOCOL_VERSION });
      pushLobby();
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
    useHost.setState({ seats: { ...host.seats, [clientId]: player.id } });
    sendTo(clientId, { t: 'welcome', playerId: player.id, room: host.room, version: PROTOCOL_VERSION });
    play('event');
    pushLobby();
    void advertise();
    return;
  }

  if (msg.t === 'move') {
    const playerId = host.seats[clientId];
    if (!playerId) return;
    const game = useApp.getState().game;
    if (!game || game.phase !== 'collecting' || game.pending[playerId]) return;
    useApp.getState().submitMove(playerId, msg.move);
    return;
  }

  if (msg.t === 'leave') {
    dropClient(clientId, true);
    return;
  }

  if (msg.t === 'ping') sendTo(clientId, { t: 'pong' });
}

function dropClient(clientId: string, explicit = false) {
  const host = useHost.getState();
  const playerId = host.seats[clientId];
  if (!playerId) return;
  const app = useApp.getState();

  if (!app.game) {
    // До старта — просто убираем из лобби.
    useApp.setState({ draft: app.draft.filter((p) => p.id !== playerId) });
    const seats = { ...host.seats };
    delete seats[clientId];
    useHost.setState({ seats });
    pushLobby();
    void advertise();
    return;
  }

  // В партии место сохраняем — вдруг переподключится.
  useApp.setState({
    game: {
      ...app.game,
      players: app.game.players.map((p) => (p.id === playerId ? { ...p, connected: false } : p)),
    },
  });
  if (explicit) {
    const seats = { ...host.seats };
    delete seats[clientId];
    useHost.setState({ seats });
  }
  // Чтобы партия не встала: отключившийся автоматически «молчит».
  const game = useApp.getState().game;
  if (game && game.phase === 'collecting' && !game.pending[playerId]) {
    setTimeout(() => {
      const g = useApp.getState().game;
      if (g && g.phase === 'collecting' && !g.pending[playerId]) {
        useApp.getState().submitMove(playerId, 'C');
      }
    }, 3000);
  }
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
    await Lan.startAdvertise({ payload: advertisePayload(), port: 45611 }).catch(() => {});
  }
  advertiseTimer = setInterval(() => void advertise(), 2000);

  useApp.getState().setNetRole('host', useApp.getState().draft[0]?.id ?? null);
  pushLobby();

  // Хост — источник истины: любое изменение партии уходит всем.
  unsubscribe = useApp.subscribe((s) => {
    if (s.game !== lastGame || s.reveal !== lastReveal) {
      lastGame = s.game;
      lastReveal = s.reveal;
      if (s.game) broadcast({ t: 'state', game: s.game, reveal: s.reveal });
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
  useHost.setState({ active: false, members: [], seats: {}, ip: '', transport: null });
  useApp.getState().setNetRole('local', null);
}

/** Синхронизировать лобби после изменений на стороне хоста (имена, боты, настройки). */
export function syncLobby() {
  if (useHost.getState().active) {
    pushLobby();
    void advertise();
  }
}

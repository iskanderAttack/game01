import { create } from 'zustand';
import { useApp } from '../store/appStore';
import { advanceTurn, fire, makePlayer, useAbility, viewFor } from '../game/engine';
import { canPlace, emptyBoard } from '../game/board';
import { getFleet } from '../game/fleet';
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
import type { GameState, Ship } from '../game/types';

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
  /** clientId → playerId. Живёт ровно столько, сколько сокет. */
  seats: Record<string, string>;
  /**
   * session → playerId. Переживает обрыв связи, поэтому вернувшийся игрок
   * садится на своё прежнее место, а не получает «Партия уже идёт».
   */
  seatsBySession: Record<string, string>;
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
}));

let transport: HostTransport | null = null;
let unsubscribe: (() => void) | null = null;
let advertiseTimer: ReturnType<typeof setInterval> | null = null;
let lastGame: GameState | null = null;
let lastFeed: string[] = [];

function lobbyMembers(): LobbyMember[] {
  const { draft, game } = useApp.getState();
  return draft.map((p, i) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    color: p.color,
    isBot: p.isBot,
    connected: p.connected !== false,
    isHost: i === 0,
    ready: game?.players.find((g) => g.id === p.id)?.ready ?? false,
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

/**
 * Рассылает каждому его собственную картину боя.
 *
 * Общее состояние отправлять нельзя: в нём лежат расстановки всех
 * флотов, и любой желающий прочитал бы их прямо из сетевого трафика.
 */
function pushViews(game: GameState) {
  const seats = useHost.getState().seats;
  for (const [clientId, playerId] of Object.entries(seats)) {
    const view = viewFor(game, playerId);
    if (view) sendTo(clientId, { t: 'view', view });
  }
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

/* ───────────────────────── приём сообщений ───────────────────────── */

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
      const game = useApp.getState().game;
      if (game) {
        const view = viewFor(game, existing);
        if (view) sendTo(clientId, { t: 'view', view });
      }
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
      if (game) {
        const view = viewFor(game, known);
        if (view) sendTo(clientId, { t: 'view', view });
      }
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

  if (msg.t === 'fleet') {
    acceptFleet(playerId, msg.ships);
    return;
  }

  if (msg.t === 'target') {
    const game = useApp.getState().game;
    if (!game || game.players[game.turnIndex]?.id !== playerId) return;
    useApp.getState().selectTarget(msg.targetId);
    return;
  }

  if (msg.t === 'fire') {
    const game = useApp.getState().game;
    if (!game || game.phase !== 'playing') return;
    if (game.players[game.turnIndex]?.id !== playerId) return;

    const result = fire(game, playerId, msg.targetId, msg.x, msg.y);
    if (!result) return;
    useApp.setState({ game: result.extraTurn ? result.state : advanceTurn(result.state) });
    useApp.getState().pushFeed(result.messages);
    useApp.getState().afterRemoteMove();
    return;
  }

  if (msg.t === 'ability') {
    const game = useApp.getState().game;
    if (!game || game.phase !== 'playing') return;
    if (game.players[game.turnIndex]?.id !== playerId) return;

    const result = useAbility(game, playerId, msg.abilityId, msg.params);
    if (result.error) return;
    useApp.setState({ game: result.extraTurn ? result.state : advanceTurn(result.state) });
    useApp.getState().pushFeed(result.messages);
    useApp.getState().afterRemoteMove();
    return;
  }

  if (msg.t === 'leave') {
    dropClient(clientId, true);
    return;
  }

  if (msg.t === 'ping') sendTo(clientId, { t: 'pong' });
}

/** Принимает расстановку от сетевого игрока, проверив её на честность. */
function acceptFleet(playerId: string, ships: Ship[]) {
  const app = useApp.getState();
  const game = app.game;
  if (!game || game.phase !== 'placement') return;

  const fleet = getFleet(game.settings.fleetId);
  const expected = [...fleet.sizes].sort((a, b) => a - b).join(',');
  const got = ships
    .map((s) => s.size)
    .sort((a, b) => a - b)
    .join(',');
  if (expected !== got) {
    diag('сеть', `отклонена расстановка ${playerId}: состав флота не совпал`);
    return;
  }

  // Проверяем каждую позицию по правилам поля, а не верим на слово.
  const probe = emptyBoard(game.settings.boardSize);
  const checked: Ship[] = [];
  for (const raw of ships) {
    const ship: Ship = { ...raw, hits: Array<boolean>(raw.size).fill(false) };
    probe.ships = checked;
    if (!canPlace(probe, ship, game.settings.allowTouching)) {
      diag('сеть', `отклонена расстановка ${playerId}: корабль вне правил`);
      return;
    }
    checked.push(ship);
  }

  useApp.setState({
    game: {
      ...game,
      players: game.players.map((p) =>
        p.id === playerId ? { ...p, board: { ...p.board, ships: checked }, ready: true } : p,
      ),
    },
  });
  useApp.getState().tryStartBattle();
  pushLobby();
}


/** Игрок вернулся: снимаем метку «не на связи». */
function reconnectPlayer(playerId: string) {
  const app = useApp.getState();
  if (app.game) {
    useApp.setState({
      game: {
        ...app.game,
        players: app.game.players.map((p) => (p.id === playerId ? { ...p, connected: true } : p)),
      },
    });
  } else {
    useApp.setState({
      draft: app.draft.map((p) => (p.id === playerId ? { ...p, connected: true } : p)),
    });
  }
}

/** Забыть место игрока насовсем — он вышел сам. */
function forgetSession(playerId: string) {
  const seatsBySession = { ...useHost.getState().seatsBySession };
  for (const [session, id] of Object.entries(seatsBySession)) {
    if (id === playerId) delete seatsBySession[session];
  }
  useHost.setState({ seatsBySession });
}

function dropClient(clientId: string, explicit = false) {
  const host = useHost.getState();
  const playerId = host.seats[clientId];
  if (!playerId) return;
  const app = useApp.getState();

  if (!app.game) {
    useApp.setState({ draft: app.draft.filter((p) => p.id !== playerId) });
    const seats = { ...host.seats };
    delete seats[clientId];
    useHost.setState({ seats });
    forgetSession(playerId);
    pushLobby();
    void advertise();
    return;
  }

  // В партии место сохраняем — игрок может вернуться.
  useApp.setState({
    game: {
      ...app.game,
      players: app.game.players.map((p) => (p.id === playerId ? { ...p, connected: false } : p)),
    },
  });
  // Привязка к сокету не нужна — сокета больше нет. А место в
  // `seatsBySession` остаётся: по нему игрок вернётся в партию.
  const seats = { ...host.seats };
  delete seats[clientId];
  useHost.setState({ seats });
  if (explicit) forgetSession(playerId);
  diag('сеть', `отключился ${playerId}`);
  pushLobby();
}

async function advertise() {
  await transport?.advertise(advertisePayload()).catch(() => {});
}

/* ───────────────────────── запуск и остановка ───────────────────────── */

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

  // Любое изменение партии тут же расходится персональными видами.
  unsubscribe = useApp.subscribe((s) => {
    if (s.game !== lastGame) {
      lastGame = s.game;
      if (s.game) pushViews(s.game);
    }
    if (s.feed !== lastFeed) {
      const fresh = s.feed.slice(0, Math.max(0, s.feed.length - lastFeed.length));
      lastFeed = s.feed;
      if (fresh.length > 0) broadcast({ t: 'feed', lines: fresh });
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

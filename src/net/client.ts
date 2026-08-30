import { create } from 'zustand';
import { useApp } from '../store/appStore';
import { Lan, canHostNatively, isNative } from './plugin';
import { clientUrl } from './transport';
import {
  DEFAULT_PORT,
  PROTOCOL_VERSION,
  RELAY_PORT,
  decode,
  encode,
  type ClientMessage,
  type HostMessage,
  type LobbyMember,
  type RoomInfo,
} from './protocol';
import { play } from '../lib/feedback';
import type { Move } from '../game/types';
import { diag } from '../lib/diag';

export type ClientStatus = 'idle' | 'connecting' | 'lobby' | 'playing' | 'error' | 'closed';

interface ClientStore {
  status: ClientStatus;
  error: string | null;
  room: string;
  playerId: string | null;
  members: LobbyMember[];
  /** Найденные в сети комнаты. */
  rooms: RoomInfo[];
  scanning: boolean;
}

export const useClient = create<ClientStore>(() => ({
  status: 'idle',
  error: null,
  room: '',
  playerId: null,
  members: [],
  rooms: [],
  scanning: false,
}));

let ws: WebSocket | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let retry = 0;
let lastTarget: { ip: string; port: number; code: string } | null = null;

function send(msg: ClientMessage) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(encode(msg));
}

export function connectToRoom(ip: string, port = DEFAULT_PORT, code = '') {
  disconnect(false);
  lastTarget = { ip, port, code };
  useClient.setState({ status: 'connecting', error: null });

  const url = clientUrl(ip, port, code);
  const socket = new WebSocket(url);
  ws = socket;

  const failTimer = setTimeout(() => {
    if (socket.readyState !== WebSocket.OPEN) {
      socket.close();
      useClient.setState({ status: 'error', error: `Комната по адресу ${ip}:${port} не отвечает` });
    }
  }, 6000);

  socket.onopen = () => {
    clearTimeout(failTimer);
    retry = 0;
    const { profile } = useApp.getState();
    send({ t: 'join', version: PROTOCOL_VERSION, name: profile.name, emoji: profile.emoji, color: profile.color });
    heartbeat = setInterval(() => send({ t: 'ping' }), 8000);
  };

  socket.onmessage = (ev) => {
    const msg = decode<HostMessage>(String(ev.data));
    if (!msg) return;
    const app = useApp.getState();

    switch (msg.t) {
      case 'welcome':
        diag('сеть', 'принят в комнату');
        useClient.setState({ status: 'lobby', playerId: msg.playerId, room: msg.room, error: null });
        app.setNetRole('client', msg.playerId);
        play('event');
        break;
      case 'reject':
        diag('сеть', 'отказ: ' + msg.reason);
        useClient.setState({ status: 'error', error: msg.reason });
        socket.close();
        break;
      case 'lobby':
        useClient.setState({ members: msg.members, room: msg.room, status: 'lobby' });
        useApp.setState({ settings: msg.settings });
        break;
      case 'state':
        diag('сеть', `состояние: раунд ${msg.game.round + 1}, фаза ${msg.game.phase}`);
        useClient.setState({ status: 'playing' });
        app.applyRemoteState(msg.game, msg.reveal);
        break;
      case 'closed':
        diag('сеть', 'комната закрыта: ' + msg.reason);
        useClient.setState({ status: 'closed', error: msg.reason });
        socket.close();
        break;
      case 'pong':
        break;
    }
  };

  socket.onclose = () => {
    clearTimeout(failTimer);
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    const status = useClient.getState().status;
    if (status === 'playing' || status === 'lobby') {
      // Мягкое переподключение — Wi-Fi любит моргать.
      if (retry < 5 && lastTarget) {
        retry++;
        useClient.setState({ status: 'connecting', error: 'Связь потеряна, переподключаемся…' });
        setTimeout(() => connectToRoom(lastTarget!.ip, lastTarget!.port, lastTarget!.code), 900 * retry);
      } else {
        useClient.setState({ status: 'closed', error: 'Соединение с комнатой потеряно' });
      }
    }
  };

  socket.onerror = () => {
    if (useClient.getState().status === 'connecting' && retry === 0) {
      useClient.setState({ status: 'error', error: `Не удалось подключиться к ${ip}:${port}` });
    }
  };
}

export function sendMove(move: Move) {
  send({ t: 'move', move });
}

export function disconnect(notifyHost = true) {
  if (notifyHost) send({ t: 'leave' });
  retry = 99;
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  ws?.close();
  ws = null;
  useClient.setState({ status: 'idle', playerId: null, members: [], room: '', error: null });
  useApp.getState().setNetRole('local', null);
}

/* ───────────────────────── поиск комнат в сети ───────────────────────── */

let discoveryHandle: { remove: () => void } | null = null;
let relayPoll: ReturnType<typeof setInterval> | null = null;

function upsertRoom(info: RoomInfo) {
  const rooms = useClient.getState().rooms;
  const next = rooms.filter((r) => !(r.ip === info.ip && r.port === info.port));
  useClient.setState({ rooms: [...next, info].slice(-12) });
}

export async function startScanning() {
  if (useClient.getState().scanning) return;
  useClient.setState({ scanning: true, rooms: [] });

  if (canHostNatively()) {
    discoveryHandle = await Lan.addListener('roomFound', ({ ip, payload }) => {
      try {
        const data = JSON.parse(payload);
        if (data.app !== 'pd') return;
        upsertRoom({
          room: data.room,
          host: data.host,
          ip: data.ip || ip,
          port: data.port ?? DEFAULT_PORT,
          players: data.players ?? 1,
          mode: data.mode ?? '',
          code: data.code ?? '',
          version: data.version ?? 1,
        });
      } catch {
        /* мусор в эфире — игнорируем */
      }
    });
    await Lan.startDiscovery({ port: 45611 }).catch(() => {});
    return;
  }

  // В браузере комнаты берём у ретранслятора.
  const host = typeof location !== 'undefined' ? location.hostname : '127.0.0.1';
  const poll = async () => {
    try {
      const res = await fetch(`http://${host}:${RELAY_PORT}/rooms`, { cache: 'no-store' });
      const data = (await res.json()) as RoomInfo[];
      useClient.setState({ rooms: data.map((r) => ({ ...r, ip: host, port: RELAY_PORT })) });
    } catch {
      /* ретранслятор не запущен — ничего страшного */
    }
  };
  void poll();
  relayPoll = setInterval(poll, 2500);
}

export async function stopScanning() {
  useClient.setState({ scanning: false });
  discoveryHandle?.remove();
  discoveryHandle = null;
  if (relayPoll) clearInterval(relayPoll);
  relayPoll = null;
  if (canHostNatively()) await Lan.stopDiscovery().catch(() => {});
}

export const supportsNativeLan = () => isNative();

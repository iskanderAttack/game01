import { create } from 'zustand';
import { useApp } from '../store/appStore';
import { Lan, canHostNatively } from './plugin';
import { clientUrl } from './transport';
import {
  APP_TAG,
  DEFAULT_PORT,
  DISCOVERY_PORT,
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
import { diag } from '../lib/diag';
import type { Action } from '../game/engine';

export type ClientStatus = 'idle' | 'connecting' | 'lobby' | 'playing' | 'error' | 'closed';

interface ClientStore {
  status: ClientStatus;
  error: string | null;
  room: string;
  playerId: string | null;
  members: LobbyMember[];
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
    send({
      t: 'join',
      version: PROTOCOL_VERSION,
      name: profile.name,
      emoji: profile.emoji,
      color: profile.color,
    });
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
        play('turn');
        break;

      case 'reject':
        diag('сеть', 'отказ: ' + msg.reason);
        useClient.setState({ status: 'error', error: msg.reason });
        socket.close();
        break;

      case 'lobby':
        useClient.setState({ members: msg.members, room: msg.room });
        useApp.setState({ settings: msg.settings });
        if (useClient.getState().status === 'connecting') useClient.setState({ status: 'lobby' });
        break;

      case 'state':
        useClient.setState({ status: 'playing' });
        app.applyRemoteState(msg.game);
        break;

      case 'error':
        useApp.setState({ error: msg.text });
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

export function sendAction(action: Action) {
  send({ t: 'act', action });
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
        // В эфире могут быть комнаты соседних игр — берём только свои.
        if (data.app !== APP_TAG) return;
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
    await Lan.startDiscovery({ port: DISCOVERY_PORT }).catch(() => {});
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

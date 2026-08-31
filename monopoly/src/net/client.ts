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
  sessionId,
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
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let attempts = 0;
/** Хотим ли мы быть в комнате. Становится false только при явном выходе. */
let wanted = false;
let lastTarget: { ip: string; port: number; code: string } | null = null;

function send(msg: ClientMessage) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(encode(msg));
}

/**
 * Рвёт сокет, НЕ трогая роль устройства.
 *
 * Это важнее, чем кажется: раньше переподключение начиналось с полного
 * `disconnect()`, который сбрасывал роль в «local». В роли «local» устройство
 * считает себя игрой на одном телефоне и разрешает ходить за любого — то есть
 * после блокировки экрана телефон начинал играть за весь стол у себя, а хост
 * об этом ничего не знал.
 */
function closeSocket() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  const socket = ws;
  ws = null;
  if (socket) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    try {
      socket.close();
    } catch {
      /* уже закрыт */
    }
  }
}

function clearReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

/** Пауза перед следующей попыткой: 0,5 → 1 → 2 → 4 → 8 с и дальше по 8. */
function backoff(): number {
  return Math.min(500 * 2 ** Math.max(0, attempts - 1), 8000);
}

function scheduleReconnect() {
  if (!wanted || !lastTarget) return;
  clearReconnect();
  attempts += 1;
  const wait = backoff();
  useApp.getState().setNetStalled(true);
  useClient.setState({ status: 'connecting', error: 'Связь потеряна, восстанавливаем…' });
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!wanted || !lastTarget) return;
    openSocket(lastTarget.ip, lastTarget.port, lastTarget.code);
  }, wait);
}

/** Попробовать прямо сейчас — например, когда игру вернули на экран. */
export function reconnectNow() {
  if (!wanted || !lastTarget) return;
  if (ws?.readyState === WebSocket.OPEN) {
    send({ t: 'ping' });
    return;
  }
  clearReconnect();
  attempts = 0;
  openSocket(lastTarget.ip, lastTarget.port, lastTarget.code);
}

export function connectToRoom(ip: string, port = DEFAULT_PORT, code = '') {
  wanted = true;
  attempts = 0;
  lastTarget = { ip, port, code };
  clearReconnect();
  useClient.setState({ status: 'connecting', error: null });
  openSocket(ip, port, code);
}

function openSocket(ip: string, port: number, code: string) {
  closeSocket();

  const url = clientUrl(ip, port, code);
  const socket = new WebSocket(url);
  ws = socket;

  const failTimer = setTimeout(() => {
    if (socket.readyState !== WebSocket.OPEN) {
      try {
        socket.close();
      } catch {
        /* уже закрыт */
      }
    }
  }, 6000);

  socket.onopen = () => {
    clearTimeout(failTimer);
    const { profile } = useApp.getState();
    send({
      t: 'join',
      version: PROTOCOL_VERSION,
      session: sessionId(),
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
        diag('сеть', attempts > 0 ? 'вернулись на своё место' : 'приняты в комнату');
        attempts = 0;
        useClient.setState({ status: 'lobby', playerId: msg.playerId, room: msg.room, error: null });
        app.setNetRole('client', msg.playerId);
        app.setNetStalled(false);
        play('turn');
        break;

      case 'reject':
        diag('сеть', 'отказ: ' + msg.reason);
        // Отказ окончателен — повторять бессмысленно.
        wanted = false;
        clearReconnect();
        app.setNetStalled(false);
        useClient.setState({ status: 'error', error: msg.reason });
        closeSocket();
        break;

      case 'lobby':
        useClient.setState({ members: msg.members, room: msg.room });
        useApp.setState({ settings: msg.settings });
        if (useClient.getState().status === 'connecting') useClient.setState({ status: 'lobby' });
        break;

      case 'state':
        useClient.setState({ status: 'playing', error: null });
        app.setNetStalled(false);
        app.applyRemoteState(msg.game);
        break;

      case 'error':
        useApp.setState({ error: msg.text });
        break;

      case 'closed':
        diag('сеть', 'комната закрыта: ' + msg.reason);
        wanted = false;
        clearReconnect();
        app.setNetStalled(false);
        useClient.setState({ status: 'closed', error: msg.reason });
        closeSocket();
        break;

      case 'pong':
        break;
    }
  };

  socket.onclose = () => {
    clearTimeout(failTimer);
    if (ws !== socket) return; // закрылся уже заменённый сокет — не наше дело
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    ws = null;
    if (!wanted) return;
    // Wi-Fi моргает, экран гаснет — пробуем снова, пока игра нужна игроку.
    scheduleReconnect();
  };

  socket.onerror = () => {
    if (!wanted) return;
    if (useClient.getState().status === 'connecting' && attempts === 0) {
      useClient.setState({ error: `Не удалось подключиться к ${ip}:${port}` });
    }
  };
}

export function sendAction(action: Action) {
  send({ t: 'act', action });
}

/** Явный выход из комнаты: только отсюда сбрасывается роль устройства. */
export function disconnect(notifyHost = true) {
  if (notifyHost) send({ t: 'leave' });
  wanted = false;
  attempts = 0;
  lastTarget = null;
  clearReconnect();
  closeSocket();
  useClient.setState({ status: 'idle', playerId: null, members: [], room: '', error: null });
  useApp.getState().setNetRole('local', null);
}

/* ─────────────── возвращение игры на экран ───────────────
   Телефон в кармане замораживает WebView и роняет сокет. Как только игру
   снова видно — не ждём таймера, пробуем подключиться сразу. */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) reconnectNow();
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => reconnectNow());
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

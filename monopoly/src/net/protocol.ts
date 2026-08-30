import type { Action } from '../game/engine';
import type { GameSettings, GameState } from '../game/types';

export const PROTOCOL_VERSION = 1;
export const DEFAULT_PORT = 45630;
export const DISCOVERY_PORT = 45631;
export const RELAY_PORT = 8789;
/** Метка приложения в эфире — чтобы не путать комнаты разных игр. */
export const APP_TAG = 'mp';

export interface LobbyMember {
  id: string;
  name: string;
  emoji: string;
  color: string;
  isBot: boolean;
  connected: boolean;
  isHost: boolean;
}

export interface RoomInfo {
  room: string;
  host: string;
  ip: string;
  port: number;
  players: number;
  mode: string;
  code: string;
  version: number;
}

/* Клиент → хост */
export type ClientMessage =
  | { t: 'join'; version: number; name: string; emoji: string; color: string }
  /** Любое игровое действие — хост проверит его движком. */
  | { t: 'act'; action: Action }
  | { t: 'leave' }
  | { t: 'ping' };

/* Хост → клиент */
export type HostMessage =
  | { t: 'welcome'; playerId: string; room: string; version: number }
  | { t: 'reject'; reason: string }
  | { t: 'lobby'; members: LobbyMember[]; settings: GameSettings; room: string }
  /**
   * Полное состояние партии.
   *
   * В отличие от морского боя, скрывать здесь нечего: доска, деньги и
   * имущество открыты всем по правилам игры.
   */
  | { t: 'state'; game: GameState }
  | { t: 'error'; text: string }
  | { t: 'closed'; reason: string }
  | { t: 'pong' };

export function encode(msg: ClientMessage | HostMessage): string {
  return JSON.stringify(msg);
}

export function decode<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Короткий код комнаты, который удобно продиктовать голосом. */
export function makeRoomCode(): string {
  const alphabet = 'ACEFHKMPRTXY3479';
  let out = '';
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

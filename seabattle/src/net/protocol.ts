import type { AbilityParams, ClientView } from '../game/engine';
import type { GameSettings, Ship } from '../game/types';

export const PROTOCOL_VERSION = 1;
export const DEFAULT_PORT = 45620;
export const DISCOVERY_PORT = 45621;
export const RELAY_PORT = 8788;
/** Метка приложения в эфире — чтобы не путать комнаты разных игр. */
export const APP_TAG = 'sb';

export interface LobbyMember {
  id: string;
  name: string;
  emoji: string;
  color: string;
  isBot: boolean;
  connected: boolean;
  isHost: boolean;
  ready: boolean;
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
  /** Клиент расставил флот у себя и присылает расстановку. */
  | { t: 'fleet'; ships: Ship[] }
  | { t: 'fire'; targetId: string; x: number; y: number }
  | { t: 'ability'; abilityId: string; params: AbilityParams }
  | { t: 'target'; targetId: string }
  | { t: 'leave' }
  | { t: 'ping' };

/* Хост → клиент */
export type HostMessage =
  | { t: 'welcome'; playerId: string; room: string; version: number }
  | { t: 'reject'; reason: string }
  | { t: 'lobby'; members: LobbyMember[]; settings: GameSettings; room: string }
  /**
   * Персональный вид партии. Общий стейт рассылать нельзя:
   * в нём лежат расстановки всех флотов.
   */
  | { t: 'view'; view: ClientView }
  | { t: 'feed'; lines: string[] }
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

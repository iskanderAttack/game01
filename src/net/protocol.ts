import type { GameSettings, GameState, Move, RoundResult } from '../game/types';

/**
 * 2 — у клиента появился постоянный `session`, по которому он возвращается
 * на своё место после обрыва связи. Со сборками версии 1 несовместимо.
 */
export const PROTOCOL_VERSION = 2;
export const DEFAULT_PORT = 45610;
export const DISCOVERY_PORT = 45611;
export const RELAY_PORT = 8787;

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
  | {
      t: 'join';
      version: number;
      /** Постоянная метка устройства — переживает обрыв связи и перезапуск. */
      session: string;
      name: string;
      emoji: string;
      color: string;
    }
  | { t: 'move'; move: Move }
  | { t: 'ready' }
  | { t: 'leave' }
  | { t: 'ping' };

/* Хост → клиент */
export type HostMessage =
  | { t: 'welcome'; playerId: string; room: string; version: number }
  | { t: 'reject'; reason: string }
  | { t: 'lobby'; members: LobbyMember[]; settings: GameSettings; room: string }
  | { t: 'state'; game: GameState; reveal: RoundResult | null }
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

/**
 * Постоянная метка этого устройства.
 *
 * Хост запоминает по ней место игрока, поэтому после блокировки экрана
 * телефон возвращается в ту же партию, а не получает «Партия уже идёт».
 */
export function sessionId(): string {
  const key = 'dilemma-session';
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
    const fresh = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    // Хранилище недоступно — метка проживёт хотя бы до перезапуска.
    return `s${Math.random().toString(36).slice(2, 12)}`;
  }
}

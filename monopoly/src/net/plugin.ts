import { registerPlugin, Capacitor, type PluginListenerHandle } from '@capacitor/core';

export interface LanPlugin {
  /** IP устройства в локальной сети. */
  getIpAddress(): Promise<{ ip: string }>;
  /** Поднимает WebSocket-сервер комнаты. */
  startServer(options: { port: number }): Promise<{ ip: string; port: number }>;
  stopServer(): Promise<void>;
  send(options: { clientId: string; data: string }): Promise<void>;
  broadcast(options: { data: string }): Promise<void>;
  /** UDP-маячок, чтобы соседние телефоны увидели комнату без ввода IP. */
  startAdvertise(options: { payload: string; port: number }): Promise<void>;
  stopAdvertise(): Promise<void>;
  updateAdvertise(options: { payload: string }): Promise<void>;
  startDiscovery(options: { port: number }): Promise<void>;
  stopDiscovery(): Promise<void>;

  addListener(
    event: 'clientConnected',
    cb: (data: { clientId: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'clientDisconnected',
    cb: (data: { clientId: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'message',
    cb: (data: { clientId: string; data: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'roomFound',
    cb: (data: { ip: string; payload: string }) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const unsupported = () => Promise.reject(new Error('LAN-плагин доступен только в приложении на Android'));

class LanWeb implements LanPlugin {
  getIpAddress() {
    return Promise.resolve({ ip: typeof location !== 'undefined' ? location.hostname : '127.0.0.1' });
  }
  startServer(): Promise<{ ip: string; port: number }> {
    return unsupported() as Promise<never>;
  }
  stopServer() {
    return Promise.resolve();
  }
  send() {
    return unsupported() as Promise<never>;
  }
  broadcast() {
    return unsupported() as Promise<never>;
  }
  startAdvertise() {
    return Promise.resolve();
  }
  stopAdvertise() {
    return Promise.resolve();
  }
  updateAdvertise() {
    return Promise.resolve();
  }
  startDiscovery() {
    return Promise.resolve();
  }
  stopDiscovery() {
    return Promise.resolve();
  }
  addListener(): Promise<PluginListenerHandle> {
    return Promise.resolve({ remove: () => Promise.resolve() } as PluginListenerHandle);
  }
  removeAllListeners() {
    return Promise.resolve();
  }
}

export const Lan = registerPlugin<LanPlugin>('Lan', { web: () => new LanWeb() });

export const isNative = () => Capacitor.isNativePlatform();

/** Умеет ли это устройство раздавать комнату само (без вспомогательного ПК). */
export const canHostNatively = () => Capacitor.isPluginAvailable('Lan') && isNative();

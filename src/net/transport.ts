import { Lan, canHostNatively } from './plugin';
import { RELAY_PORT } from './protocol';

export interface TransportHandlers {
  onConnect: (clientId: string) => void;
  onDisconnect: (clientId: string) => void;
  onMessage: (clientId: string, data: string) => void;
}

export interface HostTransport {
  readonly kind: 'native' | 'relay';
  start(port: number): Promise<{ ip: string; port: number }>;
  stop(): Promise<void>;
  send(clientId: string, data: string): void;
  broadcast(data: string): void;
  advertise(payload: string): Promise<void>;
  setHandlers(h: TransportHandlers): void;
}

/* ─────────────── нативный хост: сервер прямо на телефоне ─────────────── */

class NativeHost implements HostTransport {
  readonly kind = 'native' as const;
  private handlers?: TransportHandlers;
  private removers: Array<() => void> = [];

  setHandlers(h: TransportHandlers) {
    this.handlers = h;
  }

  async start(port: number) {
    const c = await Lan.addListener('clientConnected', ({ clientId }) => this.handlers?.onConnect(clientId));
    const d = await Lan.addListener('clientDisconnected', ({ clientId }) =>
      this.handlers?.onDisconnect(clientId),
    );
    const m = await Lan.addListener('message', ({ clientId, data }) =>
      this.handlers?.onMessage(clientId, data),
    );
    this.removers = [() => void c.remove(), () => void d.remove(), () => void m.remove()];
    return Lan.startServer({ port });
  }

  async stop() {
    this.removers.forEach((r) => r());
    this.removers = [];
    await Lan.stopAdvertise().catch(() => {});
    await Lan.stopServer().catch(() => {});
  }

  send(clientId: string, data: string) {
    void Lan.send({ clientId, data });
  }

  broadcast(data: string) {
    void Lan.broadcast({ data });
  }

  async advertise(payload: string) {
    await Lan.updateAdvertise({ payload }).catch(async () => {
      await Lan.startAdvertise({ payload, port: 45611 });
    });
  }
}

/* ───────── запасной хост через ретранслятор на ПК (для отладки) ───────── */

class RelayHost implements HostTransport {
  readonly kind = 'relay' as const;
  private ws?: WebSocket;
  private handlers?: TransportHandlers;
  private payload = '';

  constructor(private readonly room: string) {}

  setHandlers(h: TransportHandlers) {
    this.handlers = h;
  }

  start(_port: number) {
    const host = typeof location !== 'undefined' ? location.hostname : '127.0.0.1';
    const url = `ws://${host}:${RELAY_PORT}/?role=host&room=${encodeURIComponent(this.room)}`;
    return new Promise<{ ip: string; port: number }>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      const timer = setTimeout(() => reject(new Error('Ретранслятор не отвечает')), 4000);
      ws.onopen = () => {
        clearTimeout(timer);
        resolve({ ip: host, port: RELAY_PORT });
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`Не удалось подключиться к ретранслятору на ${host}:${RELAY_PORT}`));
      };
      ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data));
        if (msg.__relay === 'connect') this.handlers?.onConnect(msg.id);
        else if (msg.__relay === 'disconnect') this.handlers?.onDisconnect(msg.id);
        else if (msg.__relay === 'msg') this.handlers?.onMessage(msg.id, msg.data);
      };
    });
  }

  async stop() {
    this.ws?.close();
    this.ws = undefined;
  }

  send(clientId: string, data: string) {
    this.ws?.send(JSON.stringify({ __relay: 'to', id: clientId, data }));
  }

  broadcast(data: string) {
    this.ws?.send(JSON.stringify({ __relay: 'all', data }));
  }

  async advertise(payload: string) {
    this.payload = payload;
    this.ws?.send(JSON.stringify({ __relay: 'info', payload }));
  }
}

export function createHostTransport(room: string): HostTransport {
  return canHostNatively() ? new NativeHost() : new RelayHost(room);
}

/** Адрес, по которому клиент подключается к комнате. */
export function clientUrl(ip: string, port: number, room: string): string {
  if (port === RELAY_PORT) return `ws://${ip}:${port}/?role=client&room=${encodeURIComponent(room)}`;
  return `ws://${ip}:${port}`;
}

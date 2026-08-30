/**
 * Вспомогательный сервер комнат для отладки в браузере.
 *
 * В собранном APK он НЕ нужен: там хостом работает сам телефон через нативный
 * плагин Lan. Этот скрипт нужен только чтобы играть по Wi-Fi с ноутбука/браузера.
 *
 *   npm run lan
 *
 * Телефоны и компьютеры в той же сети открывают http://<ip-компьютера>:5173
 */
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.LAN_PORT ?? 8787);

/** room -> { host, clients: Map<id, ws>, info } */
const rooms = new Map();
let nextClientId = 1;

const http = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url?.startsWith('/rooms')) {
    const list = [...rooms.entries()]
      .filter(([, r]) => r.info)
      .map(([code, r]) => ({ ...r.info, code, players: r.clients.size + 1 }));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(list));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Ретранслятор комнат «Дилемма заключённого» работает.\n');
});

const wss = new WebSocketServer({ server: http });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const role = url.searchParams.get('role');
  const room = url.searchParams.get('room') ?? '';

  if (role === 'host') {
    const existing = rooms.get(room);
    if (existing?.host && existing.host.readyState === 1) {
      ws.close(4001, 'Комната уже занята');
      return;
    }
    const entry = { host: ws, clients: new Map(), info: null };
    rooms.set(room, entry);
    console.log(`[room ${room}] хост подключился`);

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.__relay === 'all') {
        for (const c of entry.clients.values()) if (c.readyState === 1) c.send(msg.data);
      } else if (msg.__relay === 'to') {
        const c = entry.clients.get(msg.id);
        if (c?.readyState === 1) c.send(msg.data);
      } else if (msg.__relay === 'info') {
        try {
          entry.info = JSON.parse(msg.payload);
        } catch {
          entry.info = null;
        }
      }
    });

    ws.on('close', () => {
      console.log(`[room ${room}] хост отключился`);
      for (const c of entry.clients.values()) c.close(4002, 'Комната закрыта');
      rooms.delete(room);
    });
    return;
  }

  // Обычный игрок.
  const entry = rooms.get(room);
  if (!entry || entry.host.readyState !== 1) {
    ws.close(4004, 'Комната не найдена');
    return;
  }
  const id = `c${nextClientId++}`;
  entry.clients.set(id, ws);
  entry.host.send(JSON.stringify({ __relay: 'connect', id }));
  console.log(`[room ${room}] игрок ${id} вошёл (всего ${entry.clients.size})`);

  ws.on('message', (raw) => {
    if (entry.host.readyState === 1) {
      entry.host.send(JSON.stringify({ __relay: 'msg', id, data: String(raw) }));
    }
  });

  ws.on('close', () => {
    entry.clients.delete(id);
    if (entry.host.readyState === 1) entry.host.send(JSON.stringify({ __relay: 'disconnect', id }));
    console.log(`[room ${room}] игрок ${id} вышел`);
  });
});

http.listen(PORT, () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  console.log(`Ретранслятор запущен на порту ${PORT}`);
  for (const ip of ips) console.log(`  игра:  http://${ip}:5173`);
});

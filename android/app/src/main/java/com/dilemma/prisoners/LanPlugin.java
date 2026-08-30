package com.dilemma.prisoners;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Комната прямо на телефоне: WebSocket-сервер для игроков плюс UDP-маячок,
 * благодаря которому соседние устройства находят комнату без ввода IP.
 */
@CapacitorPlugin(name = "Lan")
public class LanPlugin extends Plugin {

    private static final String TAG = "LanPlugin";

    private RoomServer server;
    private final Map<String, WebSocket> clients = new ConcurrentHashMap<>();
    private final AtomicInteger clientCounter = new AtomicInteger(1);

    private Thread advertiseThread;
    private volatile boolean advertising = false;
    private volatile String advertisePayload = "";
    private volatile int advertisePort = 45611;

    private Thread discoveryThread;
    private volatile boolean discovering = false;
    private DatagramSocket discoverySocket;
    private WifiManager.MulticastLock multicastLock;

    /* ─────────────────────────────── адрес ─────────────────────────────── */

    @PluginMethod
    public void getIpAddress(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ip", localIpAddress());
        call.resolve(result);
    }

    private String localIpAddress() {
        try {
            for (NetworkInterface iface : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (iface.isLoopback() || !iface.isUp()) continue;
                for (InetAddress addr : Collections.list(iface.getInetAddresses())) {
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Не удалось определить IP", e);
        }
        return "0.0.0.0";
    }

    /* ─────────────────────────────── сервер ────────────────────────────── */

    @PluginMethod
    public void startServer(PluginCall call) {
        int port = call.getInt("port", 45610);
        if (server != null) {
            JSObject result = new JSObject();
            result.put("ip", localIpAddress());
            result.put("port", port);
            call.resolve(result);
            return;
        }
        try {
            server = new RoomServer(new InetSocketAddress(port));
            server.setReuseAddr(true);
            server.setConnectionLostTimeout(30);
            server.start();
            JSObject result = new JSObject();
            result.put("ip", localIpAddress());
            result.put("port", port);
            call.resolve(result);
        } catch (Exception e) {
            server = null;
            call.reject("Не удалось открыть комнату: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopServer(PluginCall call) {
        try {
            if (server != null) {
                server.stop(500);
                server = null;
            }
            clients.clear();
        } catch (Exception e) {
            Log.w(TAG, "Ошибка при остановке сервера", e);
        }
        call.resolve();
    }

    @PluginMethod
    public void send(PluginCall call) {
        String clientId = call.getString("clientId");
        String data = call.getString("data");
        if (clientId == null || data == null) {
            call.reject("Нужны clientId и data");
            return;
        }
        WebSocket socket = clients.get(clientId);
        if (socket != null && socket.isOpen()) {
            try {
                socket.send(data);
            } catch (Exception e) {
                Log.w(TAG, "Не удалось отправить сообщение", e);
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void broadcast(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("Нужен data");
            return;
        }
        for (WebSocket socket : clients.values()) {
            if (socket.isOpen()) {
                try {
                    socket.send(data);
                } catch (Exception e) {
                    Log.w(TAG, "Не удалось разослать сообщение", e);
                }
            }
        }
        call.resolve();
    }

    private class RoomServer extends WebSocketServer {
        RoomServer(InetSocketAddress address) {
            super(address);
        }

        @Override
        public void onOpen(WebSocket conn, ClientHandshake handshake) {
            String id = "c" + clientCounter.getAndIncrement();
            conn.setAttachment(id);
            clients.put(id, conn);
            JSObject data = new JSObject();
            data.put("clientId", id);
            emit("clientConnected", data);
        }

        @Override
        public void onClose(WebSocket conn, int code, String reason, boolean remote) {
            String id = conn.getAttachment();
            if (id == null) return;
            clients.remove(id);
            JSObject data = new JSObject();
            data.put("clientId", id);
            emit("clientDisconnected", data);
        }

        @Override
        public void onMessage(WebSocket conn, String message) {
            String id = conn.getAttachment();
            if (id == null) return;
            JSObject data = new JSObject();
            data.put("clientId", id);
            data.put("data", message);
            emit("message", data);
        }

        @Override
        public void onError(WebSocket conn, Exception ex) {
            Log.w(TAG, "Ошибка сокета", ex);
        }

        @Override
        public void onStart() {
            Log.i(TAG, "Комната открыта");
        }
    }

    private void emit(final String event, final JSObject data) {
        if (getBridge() == null) return;
        getBridge().executeOnMainThread(() -> notifyListeners(event, data));
    }

    /* ────────────────────────────── маячок ─────────────────────────────── */

    @PluginMethod
    public void startAdvertise(PluginCall call) {
        advertisePayload = call.getString("payload", "");
        advertisePort = call.getInt("port", 45611);
        if (advertising) {
            call.resolve();
            return;
        }
        advertising = true;
        advertiseThread = new Thread(this::advertiseLoop, "lan-advertise");
        advertiseThread.setDaemon(true);
        advertiseThread.start();
        call.resolve();
    }

    @PluginMethod
    public void updateAdvertise(PluginCall call) {
        if (!advertising) {
            call.reject("Маячок не запущен");
            return;
        }
        advertisePayload = call.getString("payload", advertisePayload);
        call.resolve();
    }

    @PluginMethod
    public void stopAdvertise(PluginCall call) {
        advertising = false;
        if (advertiseThread != null) advertiseThread.interrupt();
        advertiseThread = null;
        call.resolve();
    }

    private void advertiseLoop() {
        DatagramSocket socket = null;
        try {
            socket = new DatagramSocket();
            socket.setBroadcast(true);
            while (advertising && !Thread.currentThread().isInterrupted()) {
                byte[] payload = advertisePayload.getBytes(StandardCharsets.UTF_8);
                for (InetAddress target : broadcastAddresses()) {
                    try {
                        socket.send(new DatagramPacket(payload, payload.length, target, advertisePort));
                    } catch (Exception ignored) {
                        // одна сеть может не принимать широковещание — пробуем остальные
                    }
                }
                Thread.sleep(1500);
            }
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            Log.w(TAG, "Маячок остановлен", e);
        } finally {
            if (socket != null) socket.close();
        }
    }

    private java.util.List<InetAddress> broadcastAddresses() {
        java.util.List<InetAddress> out = new java.util.ArrayList<>();
        try {
            out.add(InetAddress.getByName("255.255.255.255"));
        } catch (Exception ignored) {
        }
        try {
            Enumeration<NetworkInterface> ifaces = NetworkInterface.getNetworkInterfaces();
            while (ifaces.hasMoreElements()) {
                NetworkInterface iface = ifaces.nextElement();
                if (iface.isLoopback() || !iface.isUp()) continue;
                for (java.net.InterfaceAddress addr : iface.getInterfaceAddresses()) {
                    InetAddress broadcast = addr.getBroadcast();
                    if (broadcast != null) out.add(broadcast);
                }
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    /* ────────────────────────────── поиск ──────────────────────────────── */

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        int port = call.getInt("port", 45611);
        if (discovering) {
            call.resolve();
            return;
        }
        discovering = true;
        acquireMulticastLock();
        discoveryThread = new Thread(() -> discoveryLoop(port), "lan-discovery");
        discoveryThread.setDaemon(true);
        discoveryThread.start();
        call.resolve();
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        discovering = false;
        if (discoverySocket != null) {
            discoverySocket.close();
            discoverySocket = null;
        }
        if (discoveryThread != null) discoveryThread.interrupt();
        discoveryThread = null;
        releaseMulticastLock();
        call.resolve();
    }

    private void discoveryLoop(int port) {
        try {
            discoverySocket = new DatagramSocket(null);
            discoverySocket.setReuseAddress(true);
            discoverySocket.setBroadcast(true);
            discoverySocket.bind(new InetSocketAddress(port));
            byte[] buffer = new byte[2048];
            while (discovering && !Thread.currentThread().isInterrupted()) {
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                discoverySocket.receive(packet);
                String payload = new String(packet.getData(), 0, packet.getLength(), StandardCharsets.UTF_8);
                JSObject data = new JSObject();
                data.put("ip", packet.getAddress().getHostAddress());
                data.put("payload", payload);
                emit("roomFound", data);
            }
        } catch (Exception e) {
            if (discovering) Log.w(TAG, "Поиск комнат прерван", e);
        } finally {
            if (discoverySocket != null) {
                discoverySocket.close();
                discoverySocket = null;
            }
        }
    }

    private void acquireMulticastLock() {
        try {
            Context context = getContext().getApplicationContext();
            WifiManager wifi = (WifiManager) context.getSystemService(Context.WIFI_SERVICE);
            if (wifi == null) return;
            multicastLock = wifi.createMulticastLock("dilemma-discovery");
            multicastLock.setReferenceCounted(true);
            multicastLock.acquire();
        } catch (Exception e) {
            Log.w(TAG, "Не удалось взять multicast lock", e);
        }
    }

    private void releaseMulticastLock() {
        try {
            if (multicastLock != null && multicastLock.isHeld()) multicastLock.release();
        } catch (Exception ignored) {
        }
        multicastLock = null;
    }

    @Override
    protected void handleOnDestroy() {
        advertising = false;
        discovering = false;
        try {
            if (server != null) server.stop(200);
        } catch (Exception ignored) {
        }
        server = null;
        releaseMulticastLock();
        super.handleOnDestroy();
    }
}

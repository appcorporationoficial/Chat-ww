// privateChat.js
const WebSocket = require("ws");

// Un único servidor WS "noServer" para la ruta /ws-privado
const wssPrivado = new WebSocket.Server({ noServer: true });

// Mapa: username -> Set<sockets> (por si el mismo usuario abre varias pestañas)
const users = new Map();

function addUserSocket(username, ws) {
  if (!users.has(username)) users.set(username, new Set());
  users.get(username).add(ws);
}

function removeUserSocket(username, ws) {
  const set = users.get(username);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) users.delete(username);
}

function getUserSockets(username) {
  return users.get(username) || new Set();
}

wssPrivado.on("connection", (ws) => {
  ws.username = null; // se asignará al recibir el primer mensaje

  ws.on("message", (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    const { fromName, toName, text } = data || {};

    // Si solo llega fromName (p.ej. handshake) actualiza identidad y no responde
    if (fromName && !toName && !text) {
      if (ws.username && ws.username !== fromName) {
        removeUserSocket(ws.username, ws);
      }
      ws.username = fromName;
      addUserSocket(fromName, ws);
      return;
    }

    // Requiere los tres campos para enviar mensaje
    if (!fromName || !toName || !text) return;

    // Asegura que el socket esté registrado bajo fromName
    if (!ws.username) {
      ws.username = fromName;
      addUserSocket(fromName, ws);
    } else if (ws.username !== fromName) {
      removeUserSocket(ws.username, ws);
      ws.username = fromName;
      addUserSocket(fromName, ws);
    }

    const payload = { private: true, fromName, toName, text };

    // Eco al emisor
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }

    // Enviar a todos los sockets del destinatario (si están conectados)
    for (const sock of getUserSockets(toName)) {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify(payload));
      }
    }
  });

  ws.on("close", () => {
    if (ws.username) removeUserSocket(ws.username, ws);
  });
});

// Integración con tu HTTP server sin tocar tu ws global
function initPrivate(server) {
  server.on("upgrade", (req, socket, head) => {
    // Solo atendemos /ws-privado; otras rutas las maneja tu ws global
    if (!req.url || !req.url.startsWith("/ws-privado")) return;
    wssPrivado.handleUpgrade(req, socket, head, (client) => {
      wssPrivado.emit("connection", client, req);
    });
  });
  return wssPrivado;
}

module.exports = { initPrivate };
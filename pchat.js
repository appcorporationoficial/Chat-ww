// pchat.js
const express = require("express");
const router = express.Router();
const WebSocket = require("ws");

// Historial de mensajes privados en memoria
let lastMessages = []; // { user, text }
let clients = {};      // { id: { ws, username } }
let wssRef = null;     // referencia al WebSocket privado

// --- Rutas REST (mismo comportamiento que el chat global) ---
router.get("/mensajes", (req, res) => {
  res.json(lastMessages.slice(-5)); // últimos 5
});

router.post("/mensaje", (req, res) => {
  const { user, text } = req.body;
  if (!user || !text) return res.status(400).json({ error: "Faltan datos" });

  const id = Date.now() + "-" + Math.floor(Math.random() * 10000);
  const msg = { user, text };
  lastMessages.push(msg);
  if (lastMessages.length > 50) lastMessages.shift(); // limitar a últimos 50

  // Notificar a todos los clientes conectados
  if (wssRef) {
    wssRef.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(msg));
      }
    });
  }

  res.json({ success: true, msg });
});

// --- Inicializar WebSocket privado ---
function initWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: "/ws-privado" });
  wssRef = wss;

  wss.on("connection", ws => {
    const id = Date.now() + "-" + Math.floor(Math.random() * 10000);
    ws.id = id;

    console.log("🟢 Nuevo usuario privado conectado");

    // Enviar últimos 5 mensajes
    lastMessages.slice(-5).forEach(msg => {
      ws.send(JSON.stringify(msg));
    });

    ws.on("message", msg => {
      try {
        const data = JSON.parse(msg);
        const username = data.user || "Invitado" + Math.floor(Math.random() * 10000);

        // Guardar cliente
        clients[id] = { ws, username };

        // Guardar mensaje en historial
        lastMessages.push({ user: username, text: data.text });
        if (lastMessages.length > 50) lastMessages.shift();

        // Reenviar mensaje a todos los clientes
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ user: username, text: data.text }));
          }
        });
      } catch (error) {
        console.error("Error procesando mensaje WS privado:", error);
      }
    });

    ws.on("close", () => {
      delete clients[ws.id];
      console.log("🔴 Usuario privado desconectado");
    });
  });

  return wss;
}

module.exports = { router, initWebSocket };
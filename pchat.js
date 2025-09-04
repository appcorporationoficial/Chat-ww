const express = require("express");
const router = express.Router();
const WebSocket = require("ws");

const mensajes = []; 
let wssRef = null; // referencia al WebSocket privado

// --- Rutas REST ---
router.post("/mensaje", (req, res) => {
  const { from, to, text } = req.body;
  if (!from || !to || !text) return res.status(400).json({ error: "Faltan datos" });

  const msg = { from, to, text, time: Date.now() };
  mensajes.push(msg);

  // Notificar a los sockets privados conectados
  if (wssRef) {
    wssRef.clients.forEach(client => {
      if (client.readyState === 1 && (client.username === from || client.username === to)) {
        client.send(JSON.stringify({
          private: true,
          user: from,
          to,
          text,
          time: msg.time
        }));
      }
    });
  }

  res.json({ success: true, msg });
});

// WebSocket privado
function initWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: "/ws-privado" });
  wssRef = wss;

  wss.on("connection", ws => {
    ws.on("message", msg => {
      try {
        const data = JSON.parse(msg);
        if (data.fromName) ws.username = data.fromName;

        // Enviar últimos mensajes privados
        if (data.requestLast && data.fromName && data.toName) {
          const privados = mensajes
            .filter(m => (m.from === data.fromName && m.to === data.toName) || 
                         (m.from === data.toName && m.to === data.fromName))
            .slice(-5);
          ws.send(JSON.stringify({ private: true, history: privados }));
        }

        // Nuevo mensaje
        if (data.text && data.fromName && data.toName) {
          const nuevo = { from: data.fromName, to: data.toName, text: data.text, time: Date.now() };
          mensajes.push(nuevo);

          wss.clients.forEach(client => {
            if (client.readyState === 1 && 
               (client.username === data.fromName || client.username === data.toName)) {
              client.send(JSON.stringify({
                private: true,
                user: data.fromName,
                to: data.toName,
                text: data.text,
                time: nuevo.time
              }));
            }
          });
        }
      } catch(err) {
        console.error(err);
      }
    });
  });

  return wss;
}

module.exports = { router, initWebSocket };
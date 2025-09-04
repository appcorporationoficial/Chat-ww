// pchat.js
const express = require("express");
const router = express.Router();
const WebSocket = require("ws");

// Historial de mensajes privados en memoria
const mensajesPrivados = []; // { from, to, text, time }
let wssPrivadoRef = null; // referencia al WebSocket privado

// --- Función para notificar mensajes privados ---
function broadcastPrivate(msg) {
  if (!wssPrivadoRef) return;
  wssPrivadoRef.clients.forEach(client => {
    if (
      client.readyState === WebSocket.OPEN &&
      (client.username === msg.from || client.username === msg.to)
    ) {
      client.send(JSON.stringify({
        private: true,
        user: msg.from,
        to: msg.to,
        text: msg.text,
        time: msg.time
      }));
    }
  });
}

// --- Rutas REST ---
router.post("/mensaje", (req, res) => {
  const { from, to, text } = req.body;
  if (!from || !to || !text) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  const msg = { from, to, text, time: Date.now() };
  mensajesPrivados.push(msg);

  broadcastPrivate(msg);

  res.json({ success: true, msg });
});

router.get("/ultimos-mensajes", (req, res) => {
  const { user } = req.query;
  if (!user) return res.status(400).json({ error: "Falta usuario" });

  const recibidos = mensajesPrivados.filter(
    m => m.to === user || m.from === user
  );
  
  // Últimos 5 por contacto
  const ultimosPorUsuario = {};
  recibidos.forEach(m => {
    const key = m.from === user ? m.to : m.from;
    ultimosPorUsuario[key] = m;
  });

  const ultimos5 = Object.values(ultimosPorUsuario)
    .sort((a, b) => b.time - a.time)
    .slice(0, 5);

  res.json(ultimos5);
});

// --- Inicializar WebSocket privado ---
function initWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: "/ws-privado" });
  wssPrivadoRef = wss;

  wss.on("connection", ws => {
    ws.on("message", msg => {
      try {
        const data = JSON.parse(msg);

        // Validar datos mínimos
        if (!data.fromName) return;
        ws.username = data.fromName;

        // Enviar últimos mensajes privados si se solicita
        if (data.requestLast && data.toName) {
          const privados = mensajesPrivados
            .filter(m =>
              (m.from === data.fromName && m.to === data.toName) ||
              (m.from === data.toName && m.to === data.fromName)
            )
            .slice(-5);

          ws.send(JSON.stringify({ private: true, history: privados }));
        }

        // Nuevo mensaje privado
        if (data.text && data.toName) {
          const nuevo = {
            from: data.fromName,
            to: data.toName,
            text: data.text,
            time: Date.now()
          };
          mensajesPrivados.push(nuevo);
          broadcastPrivate(nuevo);
        }
      } catch (err) {
        console.error("WS privado:", err);
        ws.send(JSON.stringify({ error: "JSON inválido" }));
      }
    });

    ws.on("close", () => {
      console.log(`🔴 Cliente privado desconectado: ${ws.username}`);
    });
  });

  return wss;
}

module.exports = { router, initWebSocket };
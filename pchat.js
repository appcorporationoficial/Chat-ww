const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Historial de mensajes (temporal en memoria)
let mensajes = []; 
// { from, to, text, time }

// REST para guardar mensajes
app.post("/mensaje", (req, res) => {
  const { from, to, text } = req.body;
  if (!from || !to || !text) return res.status(400).json({ error: "Faltan datos" });

  const msg = { from, to, text, time: Date.now() };
  mensajes.push(msg);

  // Notificar a los sockets conectados en tiempo real
  wss.clients.forEach(client => {
    if (client.readyState === 1 && (client.username === from || client.username === to)) {
      client.send(JSON.stringify({ private: true, user: from, to, text, time: msg.time }));
    }
  });

  res.json({ success: true, msg });
});

// Endpoint para los últimos mensajes recibidos de usuarios distintos
app.get("/ultimos-mensajes", (req, res) => {
  const username = req.query.user;
  if (!username) return res.status(400).json({ error: "Falta usuario" });

  const recibidos = mensajes.filter(m => m.to === username);

  const ultimosPorUsuario = {};
  recibidos.forEach(m => {
    ultimosPorUsuario[m.from] = m; // siempre se queda el último
  });

  const ultimos5 = Object.values(ultimosPorUsuario)
                         .sort((a,b) => b.time - a.time)
                         .slice(0,5);

  res.json(ultimos5);
});

// Iniciar servidor HTTP
const server = app.listen(PORT, () => console.log(`Servidor privado corriendo en puerto ${PORT}`));

// --- Agregar WebSocket ---
const WebSocket = require("ws");
const wss = new WebSocket.Server({ server, path: "/ws-privado" });

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      // Guardar username en la conexión para filtrar notificaciones
      if (data.fromName) ws.username = data.fromName;

      if (data.requestLast && data.fromName && data.toName) {
        // Enviar últimos mensajes privados
        const privados = mensajes
          .filter(m => (m.from === data.fromName && m.to === data.toName) || (m.from === data.toName && m.to === data.fromName))
          .slice(-5);
        ws.send(JSON.stringify({ private: true, history: privados }));
      }

      // Si viene un mensaje nuevo
      if (data.text && data.fromName && data.toName) {
        const nuevo = { from: data.fromName, to: data.toName, text: data.text, time: Date.now() };
        mensajes.push(nuevo);

        // Enviar a ambos usuarios conectados
        wss.clients.forEach(client => {
          if (client.readyState === 1 && (client.username === data.fromName || client.username === data.toName)) {
            client.send(JSON.stringify({ private: true, user: data.fromName, to: data.toName, text: data.text, time: nuevo.time }));
          }
        });
      }
    } catch(err){
      console.error(err);
    }
  });
});
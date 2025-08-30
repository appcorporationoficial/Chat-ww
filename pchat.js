import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static("public")); // donde están tus HTML y JS

// Guardamos mensajes por usuario
// Estructura: { "destinatario": [ {from, to, text, time} ] }
let messages = {};

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === "private") {
        const { from, to, text } = data;
        const message = { from, to, text, time: Date.now() };

        if (!messages[to]) messages[to] = [];
        messages[to].push(message);

        // mantener solo los últimos 20 por usuario
        if (messages[to].length > 20) messages[to] = messages[to].slice(-20);

        // buscar al destinatario conectado
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === 1 && client.username === to) {
            client.send(JSON.stringify({ type: "private", ...message }));
          }
        });
      } else if (data.type === "setUsername") {
        ws.username = data.username;
      }
    } catch (err) {
      console.error("Error parsing message:", err);
    }
  });
});

// Nuevo endpoint para consultar últimos mensajes recibidos
app.get("/ultimos-mensajes", (req, res) => {
  const user = req.query.user; // el nombre del usuario que consulta
  if (!user) return res.status(400).json({ error: "Falta user en query" });

  const userMessages = messages[user] || [];
  // devolver últimos 5 ordenados del más reciente al más antiguo
  const result = [...userMessages].sort((a, b) => b.time - a.time).slice(0, 5);

  res.json(result);
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
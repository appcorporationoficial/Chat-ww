// pchat.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Mapeo de usuarios conectados
const users = new Map();

wss.on("connection", (ws) => {
  let username = null;

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      // Registrar usuario
      if (data.type === "login") {
        username = data.username;
        users.set(username, ws);
        console.log(`${username} conectado al chat privado`);
      }

      // Enviar mensaje privado
      if (data.type === "private") {
        const { to, message } = data;
        const target = users.get(to);

        if (target && target.readyState === WebSocket.OPEN) {
          target.send(
            JSON.stringify({
              type: "private",
              from: username,
              message,
            })
          );
        }
      }
    } catch (err) {
      console.error("Error procesando mensaje", err);
    }
  });

  ws.on("close", () => {
    if (username) {
      users.delete(username);
      console.log(`${username} salió del chat privado`);
    }
  });
});

// Iniciar en otro puerto para no chocar con index.js
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Servidor de chat privado en http://localhost:${PORT}`);
});
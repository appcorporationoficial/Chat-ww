// privateChat.js
const WebSocket = require("ws");

let lastMessagesPrivado = [];
let clientsPrivado = {};

function initPrivate(server) {
  // Escuchar upgrades del server
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws-privado") return;

    const ws = new WebSocket.Server({ noServer: true });

    ws.handleUpgrade(req, socket, head, (client) => {
      ws.emit("connection", client, req);

      const id = Date.now() + "-" + Math.floor(Math.random() * 10000);
      client.id = id;

      console.log("🟢 Nuevo usuario privado conectado");

      lastMessagesPrivado.slice(-5).forEach(msg => client.send(JSON.stringify(msg)));

      client.on("message", (msg) => {
        try {
          const data = JSON.parse(msg);
          const username = data.user || "Invitado" + Math.floor(Math.random() * 10000);

          clientsPrivado[id] = { ws: client, username };
          const newMsg = { user: username, text: data.text };
          lastMessagesPrivado.push(newMsg);
          if (lastMessagesPrivado.length > 50) lastMessagesPrivado.shift();

          // Reenviar solo a privados
          ws.clients.forEach(c => {
            if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(newMsg));
          });
        } catch (err) {
          console.error("Error WS privado:", err);
        }
      });

      client.on("close", () => delete clientsPrivado[id]);
    });
  });

  return true; // no es un WebSocket.Server real, pero indica que se inicializó
}

module.exports = { initPrivate };
const WebSocket = require("ws");

let lastMessages = [];
let clients = {};

function initPrivate(server) {
  const wss = new WebSocket.Server({ server, path: "/ws-privado" });

  wss.on("connection", (ws) => {
    const id = Date.now() + "-" + Math.floor(Math.random() * 10000);
    ws.id = id;

    // Enviar últimos 5 mensajes
    lastMessages.slice(-5).forEach(msg => ws.send(JSON.stringify(msg)));

    ws.on("message", (msg) => {
      const data = JSON.parse(msg);
      const username = data.user || "Invitado" + Math.floor(Math.random() * 10000);

      clients[id] = { ws, username };
      const newMsg = { user: username, text: data.text };
      lastMessages.push(newMsg);
      if (lastMessages.length > 50) lastMessages.shift();

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(newMsg));
      });
    });

    ws.on("close", () => delete clients[id]);
  });

  return wss;
}

module.exports = { initPrivate };
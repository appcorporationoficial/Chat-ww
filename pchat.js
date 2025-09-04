// pchat.js
const WebSocket = require("ws");

let lastMessagesPrivado = []; // historial de mensajes privados
let clientsPrivado = {};      // clientes conectados

function initWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: "/ws-privado" });

  wss.on("connection", (ws) => {
    const id = Date.now() + "-" + Math.floor(Math.random() * 10000);
    ws.id = id;

    console.log("🟢 Nuevo usuario privado conectado");

    // Enviar últimos 5 mensajes al conectar
    lastMessagesPrivado.slice(-5).forEach(msg => {
      ws.send(JSON.stringify(msg));
    });

    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg);
        const username = data.user || "Invitado" + Math.floor(Math.random() * 10000);

        // Guardar cliente
        clientsPrivado[id] = { ws, username };

        // Guardar mensaje en historial
        const newMsg = { user: username, text: data.text };
        lastMessagesPrivado.push(newMsg);
        if (lastMessagesPrivado.length > 50) lastMessagesPrivado.shift();

        // Reenviar mensaje a todos los clientes privados
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(newMsg));
          }
        });
      } catch (err) {
        console.error("Error WS privado:", err);
      }
    });

    ws.on("close", () => {
      delete clientsPrivado[id];
      console.log("🔴 Usuario privado desconectado");
    });
  });

  return wss;
}

module.exports = { initWebSocket };
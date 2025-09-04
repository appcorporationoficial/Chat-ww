// privateChat.js
const WebSocket = require("ws");

let lastMessagesPrivado = [];
let clientsPrivado = {};

function initPrivate(wssPrivado) {
  // Aquí recibimos el WebSocket creado en index.js
  wssPrivado.on("connection", (ws) => {
    const id = Date.now() + "-" + Math.floor(Math.random() * 10000);
    ws.id = id;

    console.log("🟢 Nuevo usuario privado conectado");

    // Manejo de mensajes
    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg);
        const username = data.fromName || "Invitado" + Math.floor(Math.random() * 10000);
        const toName = data.toName;

        clientsPrivado[id] = { ws, username };

        if (data.private && toName) {
          const newMsg = { private: true, fromName: username, toName, text: data.text };

          // Enviar solo al destinatario si está conectado
          Object.values(clientsPrivado).forEach(c => {
            if (c.username === toName || c.username === username) {
              if (c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(JSON.stringify(newMsg));
              }
            }
          });
        }
      } catch (err) {
        console.error("Error WS privado:", err);
      }
    });

    ws.on("close", () => {
      delete clientsPrivado[id];
      console.log("🔴 Usuario privado desconectado");
    });
  });
}

module.exports = { initPrivate };
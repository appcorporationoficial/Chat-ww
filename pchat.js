// pchat.js
const WebSocket = require("ws");

let lastMessagesPrivado = []; // historial privado
let clientsPrivado = {};      // clientes conectados
let wssRefPrivado = null;     // referencia al WebSocket

function initWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: "/ws-privado" });
  wssRefPrivado = wss;

  wss.on("connection", ws => {
    const id = Date.now() + "-" + Math.floor(Math.random() * 10000);
    ws.id = id;

    console.log("🟢 Nuevo usuario privado conectado");

    // Enviar últimos 5 mensajes al conectar
    lastMessagesPrivado.slice(-5).forEach(msg => {
      ws.send(JSON.stringify(msg));
    });

    ws.on("message", msg => {
      try {
        const data = JSON.parse(msg);
        const username = data.user || "Invitado" + Math.floor(Math.random() * 10000);

        // Guardar cliente
        clientsPrivado[id] = { ws, username };

        // Guardar mensaje
        lastMessagesPrivado.push({ user: username, text: data.text });
        if (lastMessagesPrivado.length > 50) lastMessagesPrivado.shift();

        // Reenviar a todos los clientes privados
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ user: username, text: data.text }));
          }
        });
      } catch (error) {
        console.error("Error WS privado:", error);
      }
    });

    ws.on("close", () => {
      delete clientsPrivado[ws.id];
      console.log("🔴 Usuario privado desconectado");
    });
  });

  return wss;
}

module.exports = { initWebSocket };
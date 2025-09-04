const WebSocket = require("ws");

let lastMessagesPrivado = [];
let clientsPrivado = {};

// Función para generar la bandeja de entrada: último mensaje de cada usuario
function getInboxForUser(username) {
  const inboxMap = {};
  lastMessagesPrivado.forEach(msg => {
    const other = msg.fromName === username ? msg.toName : msg.fromName;
    if (!inboxMap[other] || msg.timestamp > inboxMap[other].timestamp) {
      inboxMap[other] = { fromName: other, text: msg.text, timestamp: msg.timestamp || Date.now() };
    }
  });
  // Ordenar por timestamp descendente y limitar a 10
  return Object.values(inboxMap)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);
}

function initPrivate(wssPrivado) {
  wssPrivado.on("connection", (ws) => {
    const id = Date.now() + "-" + Math.floor(Math.random() * 10000);
    ws.id = id;

    console.log("🟢 Nuevo usuario privado conectado");

    // Usuario que envía mensajes
    let username = null;

    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg);
        username = data.fromName || username || "Invitado" + Math.floor(Math.random() * 10000);
        const toName = data.toName;

        // Guardar cliente
        clientsPrivado[id] = { ws, username };

        // --------------------------
        // Enviar últimos 5 mensajes privados al usuario al conectar
        if (data.requestLast) {
          const lastForUser = lastMessagesPrivado.filter(
            m => m.fromName === username || m.toName === username
          ).slice(-5);
          lastForUser.forEach(m => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
          });
          return; // No procesar como mensaje normal
        }

        // --------------------------
        // Enviar bandeja de entrada al usuario
        if (data.requestInbox) {
          const inbox = getInboxForUser(username);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ requestInboxResponse: true, messages: inbox }));
          }
          return;
        }

        // --------------------------
        // Guardar mensaje privado
        if (data.private && toName) {
          const newMsg = { private: true, fromName: username, toName, text: data.text, timestamp: Date.now() };
          lastMessagesPrivado.push(newMsg);
          if (lastMessagesPrivado.length > 100) lastMessagesPrivado.shift(); // Limitar historial

          // Enviar solo al destinatario y al remitente
          Object.values(clientsPrivado).forEach(c => {
            if (c.username === toName || c.username === username) {
              if (c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(JSON.stringify(newMsg));
              }
            }
          });

          // --------------------------
          // Notificar a todos los usuarios conectados para actualizar su bandeja en tiempo real
          Object.values(clientsPrivado).forEach(c => {
            if (c.username !== username && c.ws.readyState === WebSocket.OPEN) {
              const inboxMsg = { type: "inbox-update", message: newMsg };
              c.ws.send(JSON.stringify(inboxMsg));
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
const WebSocket = require("ws");

let lastMessagesPrivado = [];
let clientsPrivado = {};

// 🔹 Función para generar bandeja de entrada para un usuario específico
function getInboxForUser(username) {
  const inboxMap = {};

  lastMessagesPrivado.forEach(msg => {
    // Solo tomar mensajes donde el usuario esté involucrado
    if (msg.fromName === username || msg.toName === username) {
      const other = msg.fromName === username ? msg.toName : msg.fromName;

      // Guardar solo el último mensaje con ese usuario
      if (!inboxMap[other] || msg.timestamp > inboxMap[other].timestamp) {
        inboxMap[other] = {
          fromName: msg.fromName,
          toName: msg.toName,
          text: msg.text,
          timestamp: msg.timestamp
        };
      }
    }
  });

  // Ordenar por fecha descendente y limitar a 10
  return Object.values(inboxMap)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);
}

function initPrivate(wssPrivado) {
  wssPrivado.on("connection", (ws) => {
    const id = Date.now() + "-" + Math.floor(Math.random() * 10000);
    ws.id = id;

    console.log("🟢 Nuevo usuario privado conectado");

    // Usuario asociado al socket
    let username = null;

    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg);
        username = data.fromName || username || "Invitado" + Math.floor(Math.random() * 10000);
        const toName = data.toName;

        // Guardar cliente conectado
        clientsPrivado[id] = { ws, username };

        // --------------------------
        // 🔹 Enviar últimos 5 mensajes privados al usuario al conectar
        if (data.requestLast) {
          const lastForUser = lastMessagesPrivado.filter(
            m => m.fromName === username || m.toName === username
          ).slice(-5);
          lastForUser.forEach(m => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
          });
          return;
        }

        // --------------------------
        // 🔹 Enviar bandeja de entrada del usuario
        if (data.requestInbox) {
          const inbox = getInboxForUser(username);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ requestInboxResponse: true, messages: inbox }));
          }
          return;
        }

        // --------------------------
        // 🔹 Guardar mensaje privado
        if (data.private && toName) {
          const newMsg = { 
            private: true, 
            fromName: username, 
            toName, 
            text: data.text, 
            timestamp: Date.now() 
          };

          lastMessagesPrivado.push(newMsg);
          if (lastMessagesPrivado.length > 100) lastMessagesPrivado.shift(); // Limitar historial

          // 🔹 Enviar solo al remitente y destinatario
          Object.values(clientsPrivado).forEach(c => {
            if (c.username === toName || c.username === username) {
              if (c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(JSON.stringify(newMsg));
              }
            }
          });

          // 🔹 Actualizar bandeja SOLO para remitente y destinatario
          Object.values(clientsPrivado).forEach(c => {
            if (c.username === toName || c.username === username) {
              if (c.ws.readyState === WebSocket.OPEN) {
                const inbox = getInboxForUser(c.username);
                c.ws.send(JSON.stringify({ type: "inbox-update", messages: inbox }));
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
const WebSocket = require("ws");

let lastMessagesPrivado = [];
let clientsPrivado = {};

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

        // ------------------- NUEVO: Bandeja de entrada -------------------
        if (data.requestInbox) {
          // Obtener último mensaje de cada usuario (bandeja)
          const inbox = {};
          lastMessagesPrivado.forEach(m => {
            if (m.fromName !== username) inbox[m.fromName] = m;
            if (m.toName !== username) inbox[m.toName] = m;
          });
          // Convertir a array y ordenar por fecha (si tuvieras timestamp)
          const last10 = Object.values(inbox).slice(-10);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ requestInboxResponse: true, messages: last10 }));
          }
          return;
        }

        // ------------------- Mensaje normal -------------------
        if (data.private && toName) {
          const newMsg = { private: true, fromName: username, toName, text: data.text, time: Date.now() };
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

          // ------------------- NUEVO: Notificación de inbox en tiempo real -------------------
          Object.values(clientsPrivado).forEach(c => {
            if (c.username !== username && c.ws.readyState === WebSocket.OPEN) {
              c.ws.send(JSON.stringify({ type: "inbox-update", message: newMsg }));
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
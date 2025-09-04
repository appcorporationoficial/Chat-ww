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

        // 🔹 Enviar "bandeja de entrada" al conectar
        if (data.requestInbox) {
          // Agrupar por remitente
          const inboxMap = {};
          lastMessagesPrivado.forEach(m => {
            // Solo mensajes que involucran al usuario conectado
            if (m.fromName === username || m.toName === username) {
              inboxMap[m.fromName] = { fromName: m.fromName, text: m.text, time: m.time || new Date() };
            }
          });

          // Tomar últimos 10 usuarios
          const inboxArray = Object.values(inboxMap)
            .sort((a, b) => new Date(b.time) - new Date(a.time))
            .slice(0, 10);

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "inbox", messages: inboxArray }));
          }
          return; // no procesar como mensaje normal
        }

        // Guardar mensaje privado
        if (data.private && toName) {
          const newMsg = { private: true, fromName: username, toName, text: data.text, time: new Date() };
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
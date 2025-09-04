// privateChat.js
const WebSocket = require("ws");

let clientsPrivado = {}; // id → { ws, username }
let mensajesPrivados = []; // historial global { from, to, text, time }

const wssPrivado = new WebSocket.Server({ noServer: true });

function initPrivate(server) {
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws-privado") return;
    wssPrivado.handleUpgrade(req, socket, head, (ws) => {
      wssPrivado.emit("connection", ws, req);
    });
  });

  wssPrivado.on("connection", (ws) => {
    const id = Date.now() + "-" + Math.floor(Math.random() * 10000);
    ws.id = id;
    clientsPrivado[id] = { ws, username: "Invitado" + Math.floor(Math.random() * 1000) };

    console.log("🟢 Usuario privado conectado:", clientsPrivado[id].username);

    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg);

        // Registrar username
        if (data.fromName) {
          clientsPrivado[id].username = data.fromName;
        }

        // 📌 Solicitud de historial
        if (data.requestLast && data.fromName && data.toName) {
          const history = mensajesPrivados.filter(
            m =>
              (m.from === data.fromName && m.to === data.toName) ||
              (m.from === data.toName && m.to === data.fromName)
          ).slice(-5);

          ws.send(JSON.stringify({ private: true, history }));
          return;
        }

        // 📌 Nuevo mensaje privado
        if (data.text && data.fromName && data.toName) {
          const nuevo = {
            from: data.fromName,
            to: data.toName,
            text: data.text,
            time: Date.now()
          };
          mensajesPrivados.push(nuevo);
          if (mensajesPrivados.length > 100) mensajesPrivados.shift();

          // Mandar al destinatario si está conectado
          const destinatario = Object.values(clientsPrivado).find(c => c.username === data.toName);
          if (destinatario && destinatario.ws.readyState === WebSocket.OPEN) {
            destinatario.ws.send(JSON.stringify({
              private: true,
              user: nuevo.from,
              to: nuevo.to,
              text: nuevo.text,
              time: nuevo.time
            }));
          }

          // Mandar confirmación al emisor
          ws.send(JSON.stringify({
            private: true,
            user: nuevo.from,
            to: nuevo.to,
            text: nuevo.text,
            time: nuevo.time
          }));
        }
      } catch (err) {
        console.error("❌ Error en WS privado:", err);
        ws.send(JSON.stringify({ error: "Formato JSON inválido" }));
      }
    });

    ws.on("close", () => {
      console.log("🔴 Usuario privado desconectado:", clientsPrivado[id].username);
      delete clientsPrivado[id];
    });
  });

  return wssPrivado;
}

module.exports = { initPrivate };
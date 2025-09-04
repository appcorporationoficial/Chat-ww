const WebSocket = require("ws");
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors"); 
const http = require("http"); 

// Importar pchat.js
const { initPrivate } = require("./privateChat"); 

const app = express();
const PORT = process.env.PORT || 3000;

const server = http.createServer(app); 

// Middleware
app.use(cors()); // Permite que HTML externo pueda usar la API
app.use(express.json());
app.use(express.static("public")); // Si quieres servir chat.html desde Replit 

// ----------------------
// 🔹 Crear WebSockets sin asignar path al constructor
// ----------------------
const wss = new WebSocket.Server({ noServer: true });
const wssPrivado = new WebSocket.Server({ noServer: true });

// ----------------------
// 🔹 Manejar upgrade de conexión
// ----------------------
server.on("upgrade", (request, socket, head) => {
  if (request.url === "/ws-global") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else if (request.url === "/ws-privado") {
    wssPrivado.handleUpgrade(request, socket, head, (ws) => {
      wssPrivado.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
}); 

// ----------------------
// 🔹 WebSocket privado (pchats)
const wssPrivado = initPrivate(server); // /ws-privado 

// ----------------------
// 🔹 Chat Global (WebSocket)
// ---------------------- 

// WebSocket global (chat público)
const wss = new WebSocket.Server({ server, path: "/ws-global" }); 

let lastMessages = []; // { user, text }
let clients = {}; // { id: { ws, username } }

wss.on("connection", (ws) => {
  const id = Date.now() + "-" + Math.floor(Math.random() * 10000);
  ws.id = id;

  console.log("🟢 Nuevo usuario conectado");

  // Enviar últimos 5 mensajes
  lastMessages.slice(-5).forEach(msg => {
    ws.send(JSON.stringify(msg));
  });

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      const username = data.user || "Invitado" + Math.floor(Math.random() * 10000);

      // Guardar cliente
      clients[id] = { ws, username };

      // Guardar mensaje en historial
      lastMessages.push({ user: username, text: data.text });
      if (lastMessages.length > 50) lastMessages.shift(); // Limitar a últimos 50

      // Reenviar mensaje a todos
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ user: username, text: data.text }));
        }
      });
    } catch (error) {
      console.error("Error procesando mensaje:", error);
    }
  });

  ws.on("close", () => {
    delete clients[ws.id];
    console.log("🔴 Usuario desconectado");
  });
}); 

// ----------------------
// 🔹 Citas (REST API)
// ----------------------
const citasFile = path.join(__dirname, "citas.json");

// Obtener todas las solicitudes de cita
app.get("/citas", (req, res) => {
  let citas = [];
  if (fs.existsSync(citasFile)) {
    citas = JSON.parse(fs.readFileSync(citasFile, "utf-8"));
  }
  res.json(citas);
});

// Agregar nueva solicitud de cita
app.post("/citas", (req, res) => {
  const { username, edad, intereses } = req.body;
  if (!username) return res.status(400).json({ error: "Falta username" });

  let citas = [];
  if (fs.existsSync(citasFile)) {
    citas = JSON.parse(fs.readFileSync(citasFile, "utf-8"));
  }

  // Evitar duplicados por username
  if (citas.find(c => c.username === username)) {
    return res.status(400).json({ error: "Usuario ya registrado" });
  }

  const nuevaCita = { username, edad: edad || "", intereses: intereses || "", fecha: new Date() };
  citas.push(nuevaCita);

  fs.writeFileSync(citasFile, JSON.stringify(citas, null, 2));
  res.json({ success: true, cita: nuevaCita });
});

// ----------------------
// 🔹 Levantar server
// ----------------------
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en Render en puerto ${PORT}`);
});
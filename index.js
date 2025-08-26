const WebSocket = require("ws");
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Permite que HTML externo pueda usar la API
app.use(express.json());
app.use(express.static("public")); // Si quieres servir chat.html desde Replit

// ----------------------
// 🔹 Chat Global (WebSocket)
// ----------------------
const server = app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

const wss = new WebSocket.Server({ server });

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
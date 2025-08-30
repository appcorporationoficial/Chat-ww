const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Historial de mensajes (temporal en memoria)
let mensajes = []; 
// { from, to, text, time }

app.post("/mensaje", (req, res) => {
  const { from, to, text } = req.body;
  if (!from || !to || !text) return res.status(400).json({ error: "Faltan datos" });

  const msg = { from, to, text, time: Date.now() };
  mensajes.push(msg);
  res.json({ success: true, msg });
});

// Endpoint para los últimos mensajes recibidos de usuarios distintos
app.get("/ultimos-mensajes", (req, res) => {
  const username = req.query.user;
  if (!username) return res.status(400).json({ error: "Falta usuario" });

  // Filtramos mensajes donde 'to' sea username
  const recibidos = mensajes.filter(m => m.to === username);

  // Tomamos el último mensaje de cada remitente
  const ultimosPorUsuario = {};
  recibidos.forEach(m => {
    ultimosPorUsuario[m.from] = m; // siempre se queda el último
  });

  // Convertimos a array y tomamos los últimos 5
  const ultimos5 = Object.values(ultimosPorUsuario)
                         .sort((a,b) => b.time - a.time)
                         .slice(0,5);

  res.json(ultimos5);
});

app.listen(PORT, () => console.log(`Servidor privado corriendo en puerto ${PORT}`));
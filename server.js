const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.query(`
  CREATE TABLE IF NOT EXISTS reportes (
    id SERIAL PRIMARY KEY,
    tipo TEXT,
    descripcion TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    creado_en TIMESTAMP DEFAULT NOW()
  );
`).catch(err => console.error("Error creando tabla:", err));

setInterval(async () => {
  try {
    await pool.query("DELETE FROM reportes WHERE creado_en < NOW() - INTERVAL '2 hours'");
  } catch (err) {
    console.error("Error eliminando reportes:", err);
  }
}, 1000 * 60 * 10);

app.get("/reportes", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM reportes WHERE creado_en > NOW() - INTERVAL '2 hours' ORDER BY creado_en DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener reportes" });
  }
});

app.post("/reportes", async (req, res) => {
  try {
    const { tipo, descripcion, coords } = req.body;
    const result = await pool.query(
      "INSERT INTO reportes (tipo, descripcion, lat, lng) VALUES ($1,$2,$3,$4) RETURNING *",
      [tipo, descripcion, coords.lat, coords.lng]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al guardar reporte" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor corriendo en puerto", PORT));

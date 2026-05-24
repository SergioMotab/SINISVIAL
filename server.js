const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();

app.use(express.json());

// ✅ Sirve archivos estáticos desde la carpeta raíz
app.use(express.static(__dirname));

// ✅ Ruta principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Conexión DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ Manejo de error si la DB falla
pool.query(`
  CREATE TABLE IF NOT EXISTS reportes (
    id SERIAL PRIMARY KEY,
    tipo TEXT,
    descripcion TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION
  );
`).catch(err => console.error("Error creando tabla:", err));

// GET reportes
app.get("/reportes", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM reportes");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener reportes" });
  }
});

// POST reporte
app.post("/reportes", async (req, res) => {
  try {
    const { tipo, descripcion, coords } = req.body;
    const result = await pool.query(
      "INSERT INTO reportes (tipo, descripcion, lat, lng) VALUES ($1,$2,$3,$4) RETURNING *",
      [tipo, descripcion, coords.lat, coords.lng]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar reporte" });
  }
});

// Puerto dinámico
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});

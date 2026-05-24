const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();

app.use(express.json());

// ✅ servir archivos estáticos correctamente
app.use(express.static(path.join(__dirname)));

// ✅ ruta principal (IMPORTANTE)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ✅ conexión DB
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
    lng DOUBLE PRECISION
  );
`);

// GET
app.get("/reportes", async (req, res) => {
  const result = await pool.query("SELECT * FROM reportes");
  res.json(result.rows);
});

// POST
app.post("/reportes", async (req, res) => {
  const { tipo, descripcion, coords } = req.body;

  const result = await pool.query(
    "INSERT INTO reportes (tipo, descripcion, lat, lng) VALUES ($1,$2,$3,$4) RETURNING *",
    [tipo, descripcion, coords.lat, coords.lng]
  );

  res.json(result.rows[0]);
});

//PUERTO DINÁMICO 
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});

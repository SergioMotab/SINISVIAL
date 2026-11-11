const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();
app.set("trust proxy", 1); // necesario para req.ip detras de Render/Heroku

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});
app.use(express.json({ limit: "600kb" })); // las fotos viajan en base64 (max 250 KB reales)

// Solo se sirven los archivos del front.
// Antes: express.static(__dirname) exponia server.js, package.json, .env, etc.
// Si agregas imagenes u otros archivos, muevelos a una carpeta /public y usa express.static("public").
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
["script.js", "styles.css"].forEach((archivo) => {
  app.get("/" + archivo, (req, res) => res.sendFile(path.join(__dirname, archivo)));
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
`).catch(err => console.error("Error creando tabla reportes:", err));

pool.query(`
  CREATE TABLE IF NOT EXISTS mascotas (
    id SERIAL PRIMARY KEY,
    estado TEXT NOT NULL,          -- 'perdida' | 'encontrada'
    nombre TEXT,
    especie TEXT NOT NULL,         -- 'perro' | 'gato' | 'otro'
    descripcion TEXT NOT NULL,
    contacto TEXT NOT NULL,        -- celular de 10 digitos
    foto BYTEA,                    -- JPEG ya redimensionado en el cliente
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    resuelta BOOLEAN DEFAULT FALSE,
    token TEXT NOT NULL,           -- secreto de quien publico, permite cerrar el reporte
    creado_en TIMESTAMP DEFAULT NOW()
  );
`).catch(err => console.error("Error creando tabla mascotas:", err));

setInterval(async () => {
  try {
    await pool.query("DELETE FROM reportes WHERE creado_en < NOW() - INTERVAL '2 hours'");
    await pool.query("DELETE FROM mascotas WHERE creado_en < NOW() - INTERVAL '30 days'");
  } catch (err) {
    console.error("Error eliminando registros vencidos:", err);
  }
}, 1000 * 60 * 10);

/* ---------- utilidades de validacion y limite de peticiones ---------- */

const TIPOS_REPORTE = ["danger", "caution", "accident", "animal"];
const ESPECIES = ["perro", "gato", "otro"];
const ESTADOS = ["perdida", "encontrada"];
const PREFIJO_JPEG = "data:image/jpeg;base64,";
const MAX_FOTO_BYTES = 250 * 1024;

function texto(valor, max) {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

function coordsValidas(c) {
  return !!c &&
    Number.isFinite(c.lat) && Number.isFinite(c.lng) &&
    Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180;
}

// Acepta 3001234567 o 573001234567 y devuelve 10 digitos (celular colombiano) o null
function normalizarCelular(valor) {
  let d = String(valor || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("57")) d = d.slice(2);
  return /^3\d{9}$/.test(d) ? d : null;
}

// Verifica el prefijo, decodifica y comprueba los bytes magicos del JPEG (no confia en el cliente)
function parseFoto(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(PREFIJO_JPEG)) return null;
  const buf = Buffer.from(dataUrl.slice(PREFIJO_JPEG.length), "base64");
  const esJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  return esJpeg && buf.length <= MAX_FOTO_BYTES ? buf : null;
}

// Limite simple en memoria: max peticiones por IP y ruta dentro de una ventana
const golpes = new Map();
function limitar(max, ventanaMs) {
  return (req, res, next) => {
    const ahora = Date.now();
    const clave = req.ip + " " + req.method + " " + req.path;
    const recientes = (golpes.get(clave) || []).filter((t) => ahora - t < ventanaMs);
    if (recientes.length >= max) {
      return res.status(429).json({ error: "Demasiadas solicitudes, intenta mas tarde" });
    }
    recientes.push(ahora);
    golpes.set(clave, recientes);
    next();
  };
}
setInterval(() => {
  const ahora = Date.now();
  for (const [clave, lista] of golpes) {
    if (!lista.some((t) => ahora - t < 60 * 60 * 1000)) golpes.delete(clave);
  }
}, 10 * 60 * 1000);

/* ---------- incidentes viales ---------- */

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

app.post("/reportes", limitar(10, 10 * 60 * 1000), async (req, res) => {
  try {
    const body = req.body || {};
    const descripcion = texto(body.descripcion, 200);
    if (!TIPOS_REPORTE.includes(body.tipo) || !descripcion || !coordsValidas(body.coords)) {
      return res.status(400).json({ error: "Datos invalidos" });
    }
    const result = await pool.query(
      "INSERT INTO reportes (tipo, descripcion, lat, lng) VALUES ($1,$2,$3,$4) RETURNING *",
      [body.tipo, descripcion, body.coords.lat, body.coords.lng]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al guardar reporte" });
  }
});

/* ---------- mascotas perdidas / encontradas ---------- */

// Nunca se devuelve la foto (pesa) ni el token (es secreto)
const COLUMNAS_PUBLICAS =
  "id, estado, nombre, especie, descripcion, contacto, (foto IS NOT NULL) AS tiene_foto, lat, lng, creado_en";

app.get("/mascotas", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${COLUMNAS_PUBLICAS} FROM mascotas
       WHERE resuelta = FALSE AND creado_en > NOW() - INTERVAL '30 days'
       ORDER BY creado_en DESC LIMIT 200`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener mascotas" });
  }
});

app.get("/mascotas/:id/foto", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.sendStatus(404);
  try {
    const result = await pool.query(
      "SELECT foto FROM mascotas WHERE id = $1 AND resuelta = FALSE",
      [id]
    );
    const fila = result.rows[0];
    if (!fila || !fila.foto) return res.sendStatus(404);
    res.set({ "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" });
    res.send(fila.foto);
  } catch (err) {
    res.sendStatus(500);
  }
});

app.post("/mascotas", limitar(5, 10 * 60 * 1000), async (req, res) => {
  try {
    const b = req.body || {};
    const nombre = texto(b.nombre, 40);
    const descripcion = texto(b.descripcion, 300);
    const contacto = normalizarCelular(b.contacto);

    if (
      !ESTADOS.includes(b.estado) ||
      !ESPECIES.includes(b.especie) ||
      !descripcion ||
      !contacto ||
      !coordsValidas(b.coords) ||
      b.consentimiento !== true // autorizacion para publicar el celular (Ley 1581 de 2012)
    ) {
      return res.status(400).json({ error: "Datos invalidos" });
    }

    let foto = null;
    if (b.foto) {
      foto = parseFoto(b.foto);
      if (!foto) return res.status(400).json({ error: "Foto invalida (solo JPEG de hasta 250 KB)" });
    }

    const token = crypto.randomBytes(16).toString("hex");
    const result = await pool.query(
      `INSERT INTO mascotas (estado, nombre, especie, descripcion, contacto, foto, lat, lng, token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING ${COLUMNAS_PUBLICAS}`,
      [b.estado, nombre || null, b.especie, descripcion, contacto, foto, b.coords.lat, b.coords.lng, token]
    );
    // El token solo se entrega una vez, a quien publica
    res.json({ ...result.rows[0], token });
  } catch (err) {
    console.error("Error guardando mascota:", err);
    res.status(500).json({ error: "Error al guardar mascota" });
  }
});

// Cerrar un reporte ("ya aparecio" / "ya fue entregada"): solo con el token de quien lo creo
app.patch("/mascotas/:id/resuelta", limitar(20, 10 * 60 * 1000), async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const token = typeof (req.body || {}).token === "string" ? req.body.token : "";
  if (!Number.isInteger(id) || !token) return res.status(400).json({ error: "Datos invalidos" });
  try {
    const result = await pool.query(
      "UPDATE mascotas SET resuelta = TRUE WHERE id = $1 AND token = $2 RETURNING id",
      [id, token]
    );
    if (!result.rowCount) return res.status(403).json({ error: "No autorizado" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor corriendo en puerto", PORT));

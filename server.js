const express = require('express');
const { Pool } = require('pg');

const app = express();

/* ==========================
   MIDDLEWARE
========================== */
app.use(express.json());

/* ==========================
   CONEXIÓN A POSTGRES
========================== */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/* ==========================
   OBTENER REPORTES
========================== */
app.get('/reportes', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reportes ORDER BY id DESC'
    );

    res.json(result.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error obteniendo reportes'
    });
  }
});

/* ==========================
   CREAR REPORTE
========================== */
app.post('/reportes', async (req, res) => {
  try {
    const { tipo, descripcion, coords } = req.body;

    if (!tipo || !descripcion || !coords) {
      return res.status(400).json({
        error: 'Datos incompletos'
      });
    }

    const result = await pool.query(
      `
      INSERT INTO reportes (tipo, descripcion, lat, lng)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        tipo,
        descripcion,
        coords.lat,
        coords.lng
      ]
    );

    return res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error creando reporte'
    });
  }
});

/* ==========================
   SERVER
========================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

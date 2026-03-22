const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get('/reportes', async (req, res) => {
  const result = await pool.query('SELECT * FROM reportes');
  res.json(result.rows);
});

app.post('/reportes', async (req, res) => {
  const { tipo, descripcion, coords } = req.body;

  const result = await pool.query(
    'INSERT INTO reportes(tipo, descripcion, lat, lng) VALUES($1,$2,$3,$4) RETURNING *',
    [tipo, descripcion, coords.lat, coords.lng]
  );

  res.json(result.rows[0]);
});

app.listen(3000);

const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/production-lines
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM production_lines ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get production lines error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/production-lines/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM production_lines WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Production line not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get production line error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/production-lines
router.post('/', async (req, res) => {
  try {
    const { name, location, status, speed_units_per_hour, product_type, last_maintenance } = req.body;
    const result = await pool.query(
      `INSERT INTO production_lines (name, location, status, speed_units_per_hour, product_type, last_maintenance)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, location, status || 'active', speed_units_per_hour, product_type, last_maintenance]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create production line error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/production-lines/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, location, status, speed_units_per_hour, product_type, last_maintenance } = req.body;
    const result = await pool.query(
      `UPDATE production_lines SET name = $1, location = $2, status = $3, speed_units_per_hour = $4,
       product_type = $5, last_maintenance = $6 WHERE id = $7 RETURNING *`,
      [name, location, status, speed_units_per_hour, product_type, last_maintenance, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Production line not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update production line error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/production-lines/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM production_lines WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Production line not found' });
    }
    res.json({ message: 'Production line deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete production line error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

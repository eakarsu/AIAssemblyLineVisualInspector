const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/quality-goals/progress
router.get('/progress', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *, CASE WHEN target_value = 0 THEN 0 ELSE ROUND((current_value / target_value) * 100, 2) END AS progress_percentage
       FROM quality_goals ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get quality goals progress error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/quality-goals
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM quality_goals ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get quality goals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/quality-goals/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM quality_goals WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quality goal not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get quality goal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/quality-goals
router.post('/', async (req, res) => {
  try {
    const { name, description, target_value, current_value, unit, category, production_line_id, product_id, start_date, end_date, status } = req.body;
    const result = await pool.query(
      `INSERT INTO quality_goals (name, description, target_value, current_value, unit, category, production_line_id, product_id, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [name, description, target_value, current_value || 0, unit, category || 'yield', production_line_id, product_id, start_date, end_date, status || 'active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create quality goal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/quality-goals/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, description, target_value, current_value, unit, category, production_line_id, product_id, start_date, end_date, status } = req.body;
    const result = await pool.query(
      `UPDATE quality_goals SET name = $1, description = $2, target_value = $3, current_value = $4, unit = $5,
       category = $6, production_line_id = $7, product_id = $8, start_date = $9, end_date = $10, status = $11
       WHERE id = $12 RETURNING *`,
      [name, description, target_value, current_value, unit, category, production_line_id, product_id, start_date, end_date, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quality goal not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update quality goal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/quality-goals/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM quality_goals WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quality goal not found' });
    }
    res.json({ message: 'Quality goal deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete quality goal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

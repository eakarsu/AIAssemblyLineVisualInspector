const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/shifts
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, pl.name as production_line_name
       FROM shifts s
       LEFT JOIN production_lines pl ON s.production_line_id = pl.id
       ORDER BY s.date DESC, s.start_time ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get shifts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shifts/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, pl.name as production_line_name
       FROM shifts s
       LEFT JOIN production_lines pl ON s.production_line_id = pl.id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get shift error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shifts
router.post('/', async (req, res) => {
  try {
    const { name, start_time, end_time, operator_ids, production_line_id, date, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO shifts (name, start_time, end_time, operator_ids, production_line_id, date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, start_time, end_time, JSON.stringify(operator_ids || []), production_line_id, date, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create shift error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/shifts/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, start_time, end_time, operator_ids, production_line_id, date, notes } = req.body;
    const result = await pool.query(
      `UPDATE shifts SET name = $1, start_time = $2, end_time = $3, operator_ids = $4,
       production_line_id = $5, date = $6, notes = $7 WHERE id = $8 RETURNING *`,
      [name, start_time, end_time, JSON.stringify(operator_ids), production_line_id, date, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update shift error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/shifts/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM shifts WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    res.json({ message: 'Shift deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete shift error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

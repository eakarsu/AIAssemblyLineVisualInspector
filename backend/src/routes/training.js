const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

function validateTraining(body) {
  const errors = [];
  if (!body.title || !String(body.title).trim()) errors.push('title is required');
  const statuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
  if (body.status && !statuses.includes(body.status)) errors.push(`status must be one of: ${statuses.join(', ')}`);
  return errors;
}

// GET /api/training/expiring
router.get('/expiring', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM training_records WHERE expiry_date IS NOT NULL
       AND expiry_date <= NOW() + INTERVAL '30 days' AND expiry_date >= NOW()
       ORDER BY expiry_date ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get expiring training records error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/training
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM training_records ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get training records error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/training/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM training_records WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Training record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get training record error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/training
router.post('/', auth, async (req, res) => {
  const errs = validateTraining(req.body);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });
  try {
    const { operator_id, training_type, title, description, trainer, certification_name, certification_number, start_date, completion_date, expiry_date, status, score, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO training_records (operator_id, training_type, title, description, trainer, certification_name, certification_number, start_date, completion_date, expiry_date, status, score, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [operator_id, training_type || 'safety', title, description, trainer, certification_name, certification_number, start_date, completion_date, expiry_date, status || 'scheduled', score, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create training record error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/training/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { operator_id, training_type, title, description, trainer, certification_name, certification_number, start_date, completion_date, expiry_date, status, score, notes } = req.body;
    const result = await pool.query(
      `UPDATE training_records SET operator_id = $1, training_type = $2, title = $3, description = $4, trainer = $5,
       certification_name = $6, certification_number = $7, start_date = $8, completion_date = $9, expiry_date = $10,
       status = $11, score = $12, notes = $13 WHERE id = $14 RETURNING *`,
      [operator_id, training_type, title, description, trainer, certification_name, certification_number, start_date, completion_date, expiry_date, status, score, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Training record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update training record error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/training/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM training_records WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Training record not found' });
    }
    res.json({ message: 'Training record deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete training record error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

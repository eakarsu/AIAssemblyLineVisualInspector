const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/operators
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM operators ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get operators error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/operators/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM operators WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get operator error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/operators
router.post('/', async (req, res) => {
  try {
    const { name, employee_id, email, shift, role, certification_level, status } = req.body;
    const result = await pool.query(
      `INSERT INTO operators (name, employee_id, email, shift, role, certification_level, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, employee_id, email, shift, role || 'inspector', certification_level, status || 'active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create operator error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/operators/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, employee_id, email, shift, role, certification_level, status } = req.body;
    const result = await pool.query(
      `UPDATE operators SET name = $1, employee_id = $2, email = $3, shift = $4, role = $5,
       certification_level = $6, status = $7 WHERE id = $8 RETURNING *`,
      [name, employee_id, email, shift, role, certification_level, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update operator error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/operators/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM operators WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    res.json({ message: 'Operator deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete operator error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

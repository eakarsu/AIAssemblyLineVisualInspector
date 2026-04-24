const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/work-orders
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM work_orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get work orders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/work-orders/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM work_orders WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get work order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/work-orders
router.post('/', async (req, res) => {
  try {
    const { order_number, title, description, type, priority, status, production_line_id, product_id, assigned_to, quantity_ordered, quantity_completed, due_date, started_at, completed_at, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO work_orders (order_number, title, description, type, priority, status, production_line_id, product_id, assigned_to, quantity_ordered, quantity_completed, due_date, started_at, completed_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [order_number, title, description, type || 'production', priority || 'medium', status || 'pending', production_line_id, product_id, assigned_to, quantity_ordered || 0, quantity_completed || 0, due_date, started_at, completed_at, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create work order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/work-orders/:id
router.put('/:id', async (req, res) => {
  try {
    const { order_number, title, description, type, priority, status, production_line_id, product_id, assigned_to, quantity_ordered, quantity_completed, due_date, started_at, completed_at, notes } = req.body;
    const result = await pool.query(
      `UPDATE work_orders SET order_number = $1, title = $2, description = $3, type = $4, priority = $5, status = $6,
       production_line_id = $7, product_id = $8, assigned_to = $9, quantity_ordered = $10, quantity_completed = $11,
       due_date = $12, started_at = $13, completed_at = $14, notes = $15 WHERE id = $16 RETURNING *`,
      [order_number, title, description, type, priority, status, production_line_id, product_id, assigned_to, quantity_ordered, quantity_completed, due_date, started_at, completed_at, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update work order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/work-orders/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM work_orders WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    res.json({ message: 'Work order deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete work order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

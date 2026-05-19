const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

function validateBatch(body) {
  const errors = [];
  if (!body.batch_number || !String(body.batch_number).trim()) errors.push('batch_number is required');
  const statuses = ['in_progress', 'completed', 'on_hold', 'cancelled'];
  if (body.status && !statuses.includes(body.status)) errors.push(`status must be one of: ${statuses.join(', ')}`);
  return errors;
}

// GET /api/batches (paginated when ?page or ?limit provided)
router.get('/', auth, async (req, res) => {
  try {
    const usePagination = req.query.page != null || req.query.limit != null;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const baseSelect = `SELECT b.*, p.name as product_name, pl.name as production_line_name
       FROM batches b
       LEFT JOIN products p ON b.product_id = p.id
       LEFT JOIN production_lines pl ON b.production_line_id = pl.id`;

    if (!usePagination) {
      const result = await pool.query(`${baseSelect} ORDER BY b.created_at DESC`);
      return res.json(result.rows);
    }

    const countRes = await pool.query('SELECT COUNT(*) FROM batches');
    const total = parseInt(countRes.rows[0].count, 10);

    const dataRes = await pool.query(
      `${baseSelect} ORDER BY b.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      data: dataRes.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get batches error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/batches/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, p.name as product_name, pl.name as production_line_name
       FROM batches b
       LEFT JOIN products p ON b.product_id = p.id
       LEFT JOIN production_lines pl ON b.production_line_id = pl.id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get batch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/batches
router.post('/', auth, async (req, res) => {
  const errs = validateBatch(req.body);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });
  try {
    const { batch_number, product_id, production_line_id, quantity, inspected_count, pass_count, fail_count, status, started_at, completed_at } = req.body;
    const result = await pool.query(
      `INSERT INTO batches (batch_number, product_id, production_line_id, quantity, inspected_count, pass_count, fail_count, status, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [batch_number, product_id, production_line_id, quantity, inspected_count || 0, pass_count || 0, fail_count || 0, status || 'in_progress', started_at || new Date(), completed_at]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create batch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/batches/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { batch_number, product_id, production_line_id, quantity, inspected_count, pass_count, fail_count, status, started_at, completed_at } = req.body;
    const result = await pool.query(
      `UPDATE batches SET batch_number = $1, product_id = $2, production_line_id = $3, quantity = $4,
       inspected_count = $5, pass_count = $6, fail_count = $7, status = $8, started_at = $9, completed_at = $10
       WHERE id = $11 RETURNING *`,
      [batch_number, product_id, production_line_id, quantity, inspected_count, pass_count, fail_count, status, started_at, completed_at, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update batch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/batches/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM batches WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json({ message: 'Batch deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete batch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { paginatedList } = require('../paginate');

// Validate production line body
function validateProductionLine(body) {
  const errors = [];
  if (!body.name || !String(body.name).trim()) errors.push('name is required');
  const allowed = ['active', 'inactive', 'maintenance'];
  if (body.status && !allowed.includes(body.status)) errors.push(`status must be one of: ${allowed.join(', ')}`);
  return errors;
}

// GET /api/production-lines (paginated when ?page or ?limit provided)
router.get('/', auth, async (req, res) => {
  try {
    const result = await paginatedList({
      pool,
      table: 'production_lines',
      orderBy: 'created_at DESC',
      searchColumns: ['name', 'status'],
      req,
    });
    res.json(result);
  } catch (err) {
    console.error('Get production lines error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/production-lines/:id
router.get('/:id', auth, async (req, res) => {
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
router.post('/', auth, async (req, res) => {
  const errs = validateProductionLine(req.body);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });
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
router.put('/:id', auth, async (req, res) => {
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
router.delete('/:id', auth, async (req, res) => {
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

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { paginatedList } = require('../paginate');

function validateProduct(body) {
  const errors = [];
  if (!body.name || !String(body.name).trim()) errors.push('name is required');
  if (!body.sku || !String(body.sku).trim()) errors.push('sku is required');
  const threshold = parseFloat(body.quality_threshold);
  if (body.quality_threshold !== undefined && body.quality_threshold !== '' && (isNaN(threshold) || threshold < 0 || threshold > 100)) errors.push('quality_threshold must be between 0 and 100');
  return errors;
}

// GET /api/products (paginated when ?page or ?limit provided)
router.get('/', auth, async (req, res) => {
  try {
    const result = await paginatedList({
      pool,
      table: 'products',
      orderBy: 'created_at DESC',
      searchColumns: ['name', 'sku'],
      req,
    });
    res.json(result);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/products
router.post('/', auth, async (req, res) => {
  const errs = validateProduct(req.body);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });
  try {
    const { name, sku, category, description, specifications, quality_threshold } = req.body;
    const result = await pool.query(
      `INSERT INTO products (name, sku, category, description, specifications, quality_threshold)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, sku, category, description, JSON.stringify(specifications || {}), quality_threshold || 95.0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/products/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, sku, category, description, specifications, quality_threshold } = req.body;
    const result = await pool.query(
      `UPDATE products SET name = $1, sku = $2, category = $3, description = $4,
       specifications = $5, quality_threshold = $6 WHERE id = $7 RETURNING *`,
      [name, sku, category, description, JSON.stringify(specifications), quality_threshold, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

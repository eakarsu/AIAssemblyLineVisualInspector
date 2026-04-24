const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/inventory/low-stock
router.get('/low-stock', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM inventory WHERE quantity_in_stock <= minimum_stock_level ORDER BY quantity_in_stock ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get low stock inventory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inventory
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get inventory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inventory/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get inventory item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inventory
router.post('/', async (req, res) => {
  try {
    const { part_name, part_number, category, quantity_in_stock, minimum_stock_level, unit_cost, supplier, location, production_line_id, status } = req.body;
    const result = await pool.query(
      `INSERT INTO inventory (part_name, part_number, category, quantity_in_stock, minimum_stock_level, unit_cost, supplier, location, production_line_id, status, last_restocked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *`,
      [part_name, part_number, category || 'mechanical', quantity_in_stock || 0, minimum_stock_level || 0, unit_cost, supplier, location, production_line_id, status || 'in_stock']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create inventory item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/inventory/:id
router.put('/:id', async (req, res) => {
  try {
    const { part_name, part_number, category, quantity_in_stock, minimum_stock_level, unit_cost, supplier, location, production_line_id, status, last_restocked } = req.body;
    const result = await pool.query(
      `UPDATE inventory SET part_name = $1, part_number = $2, category = $3, quantity_in_stock = $4, minimum_stock_level = $5,
       unit_cost = $6, supplier = $7, location = $8, production_line_id = $9, status = $10, last_restocked = $11
       WHERE id = $12 RETURNING *`,
      [part_name, part_number, category, quantity_in_stock, minimum_stock_level, unit_cost, supplier, location, production_line_id, status, last_restocked, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update inventory item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/inventory/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM inventory WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    res.json({ message: 'Inventory item deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete inventory item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/alerts
router.get('/', async (req, res) => {
  try {
    const { severity, acknowledged } = req.query;
    let query = `SELECT a.*, pl.name as production_line_name FROM alerts a
                 LEFT JOIN production_lines pl ON a.production_line_id = pl.id`;
    const params = [];
    const conditions = [];

    if (severity) {
      params.push(severity);
      conditions.push(`a.severity = $${params.length}`);
    }
    if (acknowledged !== undefined) {
      params.push(acknowledged === 'true');
      conditions.push(`a.acknowledged = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY a.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get alerts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/alerts/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, pl.name as production_line_name FROM alerts a
       LEFT JOIN production_lines pl ON a.production_line_id = pl.id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get alert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/alerts
router.post('/', async (req, res) => {
  try {
    const { type, severity, title, message, production_line_id } = req.body;
    const result = await pool.query(
      `INSERT INTO alerts (type, severity, title, message, production_line_id, acknowledged)
       VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
      [type, severity, title, message, production_line_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create alert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/alerts/:id
router.put('/:id', async (req, res) => {
  try {
    const { type, severity, title, message, production_line_id, acknowledged, acknowledged_by, acknowledged_at } = req.body;
    const result = await pool.query(
      `UPDATE alerts SET type = $1, severity = $2, title = $3, message = $4, production_line_id = $5,
       acknowledged = $6, acknowledged_by = $7, acknowledged_at = $8 WHERE id = $9 RETURNING *`,
      [type, severity, title, message, production_line_id, acknowledged, acknowledged_by, acknowledged_at, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update alert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/alerts/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM alerts WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ message: 'Alert deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete alert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

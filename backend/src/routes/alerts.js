const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { notifyCriticalDefect } = require('../services/notificationService');

function validateAlert(body) {
  const errors = [];
  if (!body.title || !String(body.title).trim()) errors.push('title is required');
  if (!body.message || !String(body.message).trim()) errors.push('message is required');
  const severities = ['critical', 'high', 'medium', 'low'];
  if (body.severity && !severities.includes(body.severity)) errors.push(`severity must be one of: ${severities.join(', ')}`);
  return errors;
}

// GET /api/alerts (paginated when ?page or ?limit provided)
router.get('/', auth, async (req, res) => {
  try {
    const { severity, acknowledged } = req.query;
    const usePagination = req.query.page != null || req.query.limit != null;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

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

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    if (!usePagination) {
      const result = await pool.query(
        `SELECT a.*, pl.name as production_line_name FROM alerts a
         LEFT JOIN production_lines pl ON a.production_line_id = pl.id
         ${whereClause}
         ORDER BY a.created_at DESC`,
        params
      );
      return res.json(result.rows);
    }

    const countRes = await pool.query(`SELECT COUNT(*) FROM alerts a ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(limit);
    params.push(offset);
    const dataRes = await pool.query(
      `SELECT a.*, pl.name as production_line_name FROM alerts a
       LEFT JOIN production_lines pl ON a.production_line_id = pl.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: dataRes.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get alerts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/alerts/:id
router.get('/:id', auth, async (req, res) => {
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
router.post('/', auth, async (req, res) => {
  const errs = validateAlert(req.body);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });
  try {
    const { type, severity, title, message, production_line_id } = req.body;
    const result = await pool.query(
      `INSERT INTO alerts (type, severity, title, message, production_line_id, acknowledged)
       VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
      [type, severity, title, message, production_line_id]
    );
    const alert = result.rows[0];

    // Fetch production line name for context
    if (production_line_id) {
      const lineResult = await pool.query('SELECT name FROM production_lines WHERE id = $1', [production_line_id]);
      if (lineResult.rows.length > 0) {
        alert.production_line_name = lineResult.rows[0].name;
      }
    }

    // Emit WebSocket event and send notifications for critical alerts
    if (severity === 'critical') {
      const io = req.app.get('io');
      if (io) {
        io.emit('alert:critical', alert);
      }
      // Fire-and-forget notifications
      notifyCriticalDefect(alert).catch((err) =>
        console.error('Notification error:', err)
      );
    }

    res.status(201).json(alert);
  } catch (err) {
    console.error('Create alert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/alerts/:id
router.put('/:id', auth, async (req, res) => {
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
router.delete('/:id', auth, async (req, res) => {
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

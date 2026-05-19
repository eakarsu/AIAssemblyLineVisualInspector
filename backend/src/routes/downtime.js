const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

function validateDowntime(body) {
  const errors = [];
  if (!body.reason || !String(body.reason).trim()) errors.push('reason is required');
  if (!body.start_time) errors.push('start_time is required');
  return errors;
}

// GET /api/downtime/stats - aggregate stats (must be before /:id)
router.get('/stats', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) AS total_events,
        COALESCE(SUM(duration_minutes), 0) AS total_downtime_minutes,
        ROUND(COALESCE(SUM(duration_minutes) / 60.0, 0), 2) AS total_downtime_hours,
        ROUND(COALESCE(AVG(duration_minutes), 0), 2) AS avg_duration_minutes
      FROM downtime_events
    `);
    const byReason = await pool.query(`
      SELECT reason, COUNT(*) AS count,
        COALESCE(SUM(duration_minutes), 0) AS total_minutes
      FROM downtime_events
      GROUP BY reason
      ORDER BY total_minutes DESC
    `);
    res.json({
      ...result.rows[0],
      by_reason: byReason.rows
    });
  } catch (err) {
    console.error('Get downtime stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/downtime
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, pl.name as production_line_name
       FROM downtime_events d
       LEFT JOIN production_lines pl ON d.production_line_id = pl.id
       ORDER BY d.start_time DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get downtime events error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/downtime/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, pl.name as production_line_name
       FROM downtime_events d
       LEFT JOIN production_lines pl ON d.production_line_id = pl.id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Downtime event not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get downtime event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/downtime
router.post('/', auth, async (req, res) => {
  const errs = validateDowntime(req.body);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });
  try {
    const { production_line_id, reason, start_time, end_time, duration_minutes, description, impact, resolved_by } = req.body;
    const result = await pool.query(
      `INSERT INTO downtime_events (production_line_id, reason, start_time, end_time, duration_minutes, description, impact, resolved_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [production_line_id, reason, start_time, end_time, duration_minutes, description, impact, resolved_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create downtime event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/downtime/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { production_line_id, reason, start_time, end_time, duration_minutes, description, impact, resolved_by } = req.body;
    const result = await pool.query(
      `UPDATE downtime_events SET production_line_id = $1, reason = $2, start_time = $3, end_time = $4,
       duration_minutes = $5, description = $6, impact = $7, resolved_by = $8 WHERE id = $9 RETURNING *`,
      [production_line_id, reason, start_time, end_time, duration_minutes, description, impact, resolved_by, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Downtime event not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update downtime event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/downtime/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM downtime_events WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Downtime event not found' });
    }
    res.json({ message: 'Downtime event deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete downtime event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

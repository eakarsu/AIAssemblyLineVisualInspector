const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

function validateMaintenance(body) {
  const errors = [];
  if (!body.title || !String(body.title).trim()) errors.push('title is required');
  if (!body.scheduled_date) errors.push('scheduled_date is required');
  const priorities = ['low', 'medium', 'high', 'critical'];
  if (body.priority && !priorities.includes(body.priority)) errors.push(`priority must be one of: ${priorities.join(', ')}`);
  return errors;
}

// GET /api/maintenance
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, pl.name as production_line_name
       FROM maintenance_schedules m
       LEFT JOIN production_lines pl ON m.production_line_id = pl.id
       ORDER BY m.scheduled_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get maintenance schedules error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/maintenance/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, pl.name as production_line_name
       FROM maintenance_schedules m
       LEFT JOIN production_lines pl ON m.production_line_id = pl.id
       WHERE m.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance schedule not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get maintenance schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/maintenance
router.post('/', auth, async (req, res) => {
  const errs = validateMaintenance(req.body);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });
  try {
    const { production_line_id, type, title, description, priority, status, assigned_to, scheduled_date, completed_date, estimated_duration_hours, actual_duration_hours, parts_required, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO maintenance_schedules (production_line_id, type, title, description, priority, status, assigned_to, scheduled_date, completed_date, estimated_duration_hours, actual_duration_hours, parts_required, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [production_line_id, type, title, description, priority, status || 'scheduled', assigned_to, scheduled_date, completed_date, estimated_duration_hours, actual_duration_hours, JSON.stringify(parts_required || []), notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create maintenance schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/maintenance/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { production_line_id, type, title, description, priority, status, assigned_to, scheduled_date, completed_date, estimated_duration_hours, actual_duration_hours, parts_required, notes } = req.body;
    const result = await pool.query(
      `UPDATE maintenance_schedules SET production_line_id = $1, type = $2, title = $3, description = $4,
       priority = $5, status = $6, assigned_to = $7, scheduled_date = $8, completed_date = $9,
       estimated_duration_hours = $10, actual_duration_hours = $11, parts_required = $12, notes = $13
       WHERE id = $14 RETURNING *`,
      [production_line_id, type, title, description, priority, status, assigned_to, scheduled_date, completed_date, estimated_duration_hours, actual_duration_hours, JSON.stringify(parts_required), notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance schedule not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update maintenance schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/maintenance/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM maintenance_schedules WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance schedule not found' });
    }
    res.json({ message: 'Maintenance schedule deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete maintenance schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

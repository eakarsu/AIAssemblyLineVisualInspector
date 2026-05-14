const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

function validateCameraFeed(body) {
  const errors = [];
  if (!body.name || !String(body.name).trim()) errors.push('name is required');
  const statuses = ['online', 'offline', 'maintenance'];
  if (body.status && !statuses.includes(body.status)) errors.push(`status must be one of: ${statuses.join(', ')}`);
  return errors;
}

// GET /api/camera-feeds
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cf.*, pl.name as production_line_name
       FROM camera_feeds cf
       LEFT JOIN production_lines pl ON cf.production_line_id = pl.id
       ORDER BY cf.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get camera feeds error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/camera-feeds/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cf.*, pl.name as production_line_name
       FROM camera_feeds cf
       LEFT JOIN production_lines pl ON cf.production_line_id = pl.id
       WHERE cf.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Camera feed not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get camera feed error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/camera-feeds
router.post('/', auth, async (req, res) => {
  const errs = validateCameraFeed(req.body);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });
  try {
    const { name, production_line_id, position, resolution, fps, status, stream_url } = req.body;
    const result = await pool.query(
      `INSERT INTO camera_feeds (name, production_line_id, position, resolution, fps, status, stream_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, production_line_id, position, resolution, fps, status || 'online', stream_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create camera feed error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/camera-feeds/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, production_line_id, position, resolution, fps, status, stream_url } = req.body;
    const result = await pool.query(
      `UPDATE camera_feeds SET name = $1, production_line_id = $2, position = $3, resolution = $4,
       fps = $5, status = $6, stream_url = $7 WHERE id = $8 RETURNING *`,
      [name, production_line_id, position, resolution, fps, status, stream_url, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Camera feed not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update camera feed error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/camera-feeds/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM camera_feeds WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Camera feed not found' });
    }
    res.json({ message: 'Camera feed deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete camera feed error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

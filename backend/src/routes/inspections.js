const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// Validation helper
function validateInspection(body) {
  const errors = [];
  const { status } = body;
  const allowed = ['pass', 'fail', 'warning'];
  if (status && !allowed.includes(status)) errors.push(`status must be one of: ${allowed.join(', ')}`);
  const defect_count = parseInt(body.defect_count, 10);
  if (body.defect_count !== undefined && body.defect_count !== '' && (isNaN(defect_count) || defect_count < 0)) errors.push('defect_count must be a non-negative integer');
  const confidence_score = parseFloat(body.confidence_score);
  if (body.confidence_score !== undefined && body.confidence_score !== '' && (isNaN(confidence_score) || confidence_score < 0 || confidence_score > 100)) errors.push('confidence_score must be between 0 and 100');
  return errors;
}

// GET /api/inspections (with pagination and filters)
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, production_line_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = '';
    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`i.status = $${params.length}`);
    }
    if (production_line_id) {
      params.push(production_line_id);
      conditions.push(`i.production_line_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    params.push(parseInt(limit));
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM inspections i ${whereClause}`,
      params.slice(0, params.length - 2)
    );

    const result = await pool.query(
      `SELECT i.*, pl.name as production_line_name, p.name as product_name
       FROM inspections i
       LEFT JOIN production_lines pl ON i.production_line_id = pl.id
       LEFT JOIN products p ON i.product_id = p.id
       ${whereClause}
       ORDER BY i.created_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get inspections error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inspections/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, pl.name as production_line_name, p.name as product_name
       FROM inspections i
       LEFT JOIN production_lines pl ON i.production_line_id = pl.id
       LEFT JOIN products p ON i.product_id = p.id
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get inspection error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inspections
router.post('/', auth, async (req, res) => {
  const errs = validateInspection(req.body);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });
  try {
    const {
      production_line_id, camera_feed_id, product_id, batch_id, operator_id,
      status, defect_count, defect_types, confidence_score, ai_analysis, image_url, inspected_at
    } = req.body;
    const result = await pool.query(
      `INSERT INTO inspections (production_line_id, camera_feed_id, product_id, batch_id, operator_id,
       status, defect_count, defect_types, confidence_score, ai_analysis, image_url, inspected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [production_line_id, camera_feed_id, product_id, batch_id, operator_id,
       status || 'pass', defect_count || 0, JSON.stringify(defect_types || []),
       confidence_score, JSON.stringify(ai_analysis || {}), image_url, inspected_at || new Date()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create inspection error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/inspections/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const {
      production_line_id, camera_feed_id, product_id, batch_id, operator_id,
      status, defect_count, defect_types, confidence_score, ai_analysis, image_url, inspected_at
    } = req.body;
    const result = await pool.query(
      `UPDATE inspections SET production_line_id = $1, camera_feed_id = $2, product_id = $3,
       batch_id = $4, operator_id = $5, status = $6, defect_count = $7, defect_types = $8,
       confidence_score = $9, ai_analysis = $10, image_url = $11, inspected_at = $12
       WHERE id = $13 RETURNING *`,
      [production_line_id, camera_feed_id, product_id, batch_id, operator_id,
       status, defect_count, JSON.stringify(defect_types), confidence_score,
       JSON.stringify(ai_analysis), image_url, inspected_at, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update inspection error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/inspections/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM inspections WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    res.json({ message: 'Inspection deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete inspection error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

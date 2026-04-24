const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/audit-trail/stats - action counts by type (must be before /:id)
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT action, COUNT(*) AS count
      FROM audit_trail
      GROUP BY action
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get audit trail stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/audit-trail - list with pagination and filters
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { action, entity_type } = req.query;

    let whereClause = '';
    const params = [];
    const conditions = [];

    if (action) {
      params.push(action);
      conditions.push(`a.action = $${params.length}`);
    }
    if (entity_type) {
      params.push(entity_type);
      conditions.push(`a.entity_type = $${params.length}`);
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_trail a ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const dataParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT a.*, u.name as user_name
       FROM audit_trail a
       LEFT JOIN users u ON a.user_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get audit trail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/audit-trail
router.post('/', async (req, res) => {
  try {
    const { user_id, action, entity_type, entity_id, details, ip_address } = req.body;
    const result = await pool.query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_id, action, entity_type, entity_id, JSON.stringify(details || {}), ip_address]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create audit trail entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

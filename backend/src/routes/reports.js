const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/reports
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, pl.name as production_line_name
       FROM reports r
       LEFT JOIN production_lines pl ON r.production_line_id = pl.id
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, pl.name as production_line_name
       FROM reports r
       LEFT JOIN production_lines pl ON r.production_line_id = pl.id
       WHERE r.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reports
router.post('/', async (req, res) => {
  try {
    const { title, type, production_line_id, date_from, date_to, data, generated_by } = req.body;
    const result = await pool.query(
      `INSERT INTO reports (title, type, production_line_id, date_from, date_to, data, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, type, production_line_id, date_from, date_to, JSON.stringify(data || {}), generated_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reports/generate
router.post('/generate', async (req, res) => {
  try {
    const { type, production_line_id, date_from, date_to, generated_by } = req.body;

    let whereClause = 'WHERE inspected_at >= $1 AND inspected_at <= $2';
    const params = [date_from, date_to];

    if (production_line_id) {
      params.push(production_line_id);
      whereClause += ` AND production_line_id = $${params.length}`;
    }

    const inspections = await pool.query(
      `SELECT
         COUNT(*) as total_inspections,
         SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count,
         SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as fail_count,
         SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_count,
         AVG(confidence_score) as avg_confidence,
         SUM(defect_count) as total_defects
       FROM inspections ${whereClause}`,
      params
    );

    const dailyBreakdown = await pool.query(
      `SELECT
         DATE(inspected_at) as date,
         COUNT(*) as total,
         SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count,
         SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as fail_count
       FROM inspections ${whereClause}
       GROUP BY DATE(inspected_at)
       ORDER BY date ASC`,
      params
    );

    const topDefects = await pool.query(
      `SELECT defect_types, COUNT(*) as count
       FROM inspections
       ${whereClause} AND defect_count > 0
       GROUP BY defect_types
       ORDER BY count DESC
       LIMIT 10`,
      params
    );

    const summary = inspections.rows[0];
    const total = parseInt(summary.total_inspections);
    const passed = parseInt(summary.pass_count);

    const reportData = {
      summary: {
        total_inspections: total,
        pass_count: passed,
        fail_count: parseInt(summary.fail_count),
        warning_count: parseInt(summary.warning_count),
        pass_rate: total > 0 ? ((passed / total) * 100).toFixed(2) : 0,
        avg_confidence: parseFloat(summary.avg_confidence || 0).toFixed(2),
        total_defects: parseInt(summary.total_defects || 0),
      },
      daily_breakdown: dailyBreakdown.rows,
      top_defects: topDefects.rows,
    };

    const lineName = production_line_id
      ? (await pool.query('SELECT name FROM production_lines WHERE id = $1', [production_line_id])).rows[0]?.name || 'All Lines'
      : 'All Lines';

    const title = `${type.charAt(0).toUpperCase() + type.slice(1)} Quality Report - ${lineName}`;

    const result = await pool.query(
      `INSERT INTO reports (title, type, production_line_id, date_from, date_to, data, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, type, production_line_id, date_from, date_to, JSON.stringify(reportData), generated_by]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Generate report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/reports/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, type, production_line_id, date_from, date_to, data, generated_by } = req.body;
    const result = await pool.query(
      `UPDATE reports SET title = $1, type = $2, production_line_id = $3, date_from = $4,
       date_to = $5, data = $6, generated_by = $7 WHERE id = $8 RETURNING *`,
      [title, type, production_line_id, date_from, date_to, JSON.stringify(data), generated_by, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/reports/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM reports WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json({ message: 'Report deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

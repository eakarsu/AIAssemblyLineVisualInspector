const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/dashboard
router.get('/', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const totalInspectionsToday = await pool.query(
      'SELECT COUNT(*) FROM inspections WHERE inspected_at >= $1',
      [todayStart]
    );

    const passRateToday = await pool.query(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count
       FROM inspections WHERE inspected_at >= $1`,
      [todayStart]
    );

    const activeLines = await pool.query(
      "SELECT COUNT(*) FROM production_lines WHERE status = 'active'"
    );

    const openAlerts = await pool.query(
      'SELECT COUNT(*) FROM alerts WHERE acknowledged = false'
    );

    const recentInspections = await pool.query(
      `SELECT i.*, pl.name as production_line_name, p.name as product_name
       FROM inspections i
       LEFT JOIN production_lines pl ON i.production_line_id = pl.id
       LEFT JOIN products p ON i.product_id = p.id
       ORDER BY i.created_at DESC LIMIT 10`
    );

    const defectDistribution = await pool.query(
      `SELECT
         COALESCE(status, 'unknown') as status,
         COUNT(*) as count
       FROM inspections
       WHERE inspected_at >= $1
       GROUP BY status`,
      [todayStart]
    );

    const recentAlerts = await pool.query(
      `SELECT a.*, pl.name as production_line_name
       FROM alerts a
       LEFT JOIN production_lines pl ON a.production_line_id = pl.id
       WHERE a.acknowledged = false
       ORDER BY a.created_at DESC LIMIT 5`
    );

    const lineStatus = await pool.query(
      'SELECT id, name, status, speed_units_per_hour, product_type FROM production_lines ORDER BY name'
    );

    const todayTotal = parseInt(passRateToday.rows[0].total);
    const todayPassed = parseInt(passRateToday.rows[0].pass_count);

    res.json({
      total_inspections_today: parseInt(totalInspectionsToday.rows[0].count),
      pass_rate_today: todayTotal > 0 ? ((todayPassed / todayTotal) * 100).toFixed(2) : 0,
      active_lines: parseInt(activeLines.rows[0].count),
      open_alerts: parseInt(openAlerts.rows[0].count),
      recent_inspections: recentInspections.rows,
      defect_distribution: defectDistribution.rows,
      recent_alerts: recentAlerts.rows,
      line_status: lineStatus.rows,
    });
  } catch (err) {
    console.error('Get dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// GET /api/quality-metrics/summary
router.get('/summary', auth, async (req, res) => {
  try {
    const totalInspections = await pool.query('SELECT COUNT(*) FROM inspections');
    const passCount = await pool.query("SELECT COUNT(*) FROM inspections WHERE status = 'pass'");
    const failCount = await pool.query("SELECT COUNT(*) FROM inspections WHERE status = 'fail'");
    const warningCount = await pool.query("SELECT COUNT(*) FROM inspections WHERE status = 'warning'");
    const avgConfidence = await pool.query('SELECT AVG(confidence_score) as avg_confidence FROM inspections');
    const totalDefects = await pool.query('SELECT SUM(defect_count) as total_defects FROM inspections');
    const activeLines = await pool.query("SELECT COUNT(*) FROM production_lines WHERE status = 'active'");

    const total = parseInt(totalInspections.rows[0].count);
    const passed = parseInt(passCount.rows[0].count);

    res.json({
      total_inspections: total,
      pass_count: passed,
      fail_count: parseInt(failCount.rows[0].count),
      warning_count: parseInt(warningCount.rows[0].count),
      pass_rate: total > 0 ? ((passed / total) * 100).toFixed(2) : 0,
      average_confidence: parseFloat(avgConfidence.rows[0].avg_confidence || 0).toFixed(2),
      total_defects: parseInt(totalDefects.rows[0].total_defects || 0),
      active_lines: parseInt(activeLines.rows[0].count),
    });
  } catch (err) {
    console.error('Get quality summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/quality-metrics/trend
router.get('/trend', auth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await pool.query(
      `SELECT
         DATE(inspected_at) as date,
         COUNT(*) as total,
         SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count,
         SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as fail_count,
         SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_count,
         AVG(confidence_score) as avg_confidence,
         SUM(defect_count) as total_defects,
         CASE WHEN COUNT(*) > 0
           THEN ROUND((SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric * 100), 2)
           ELSE 0 END as pass_rate
       FROM inspections
       WHERE inspected_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY DATE(inspected_at)
       ORDER BY date ASC`,
      [parseInt(days)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get quality trend error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/quality-metrics/by-line
router.get('/by-line', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         pl.id, pl.name,
         COUNT(i.id) as total_inspections,
         SUM(CASE WHEN i.status = 'pass' THEN 1 ELSE 0 END) as pass_count,
         SUM(CASE WHEN i.status = 'fail' THEN 1 ELSE 0 END) as fail_count,
         ROUND(AVG(i.confidence_score)::numeric, 2) as avg_confidence,
         SUM(i.defect_count) as total_defects,
         CASE WHEN COUNT(i.id) > 0
           THEN ROUND((SUM(CASE WHEN i.status = 'pass' THEN 1 ELSE 0 END)::numeric / COUNT(i.id) * 100), 2)
           ELSE 0 END as pass_rate
       FROM production_lines pl
       LEFT JOIN inspections i ON pl.id = i.production_line_id
       GROUP BY pl.id, pl.name
       ORDER BY pl.name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get quality by line error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/quality-metrics/by-defect
router.get('/by-defect', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         dl.name as defect_name,
         dl.category,
         dl.severity,
         COUNT(i.id) as occurrence_count,
         COUNT(i.id) as count
       FROM defect_library dl
       LEFT JOIN inspections i ON i.defect_types::text LIKE '%' || dl.code || '%'
       GROUP BY dl.id, dl.name, dl.category, dl.severity
       ORDER BY occurrence_count DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get quality by defect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/quality-metrics/spc
router.get('/spc', auth, async (req, res) => {
  try {
    const { production_line_id, days = 30 } = req.query;

    let whereClause = "WHERE inspected_at >= NOW() - INTERVAL '1 day' * $1";
    const params = [parseInt(days)];

    if (production_line_id) {
      params.push(production_line_id);
      whereClause += ` AND production_line_id = $${params.length}`;
    }

    const dataResult = await pool.query(
      `SELECT
         DATE(inspected_at) as date,
         COUNT(*) as sample_size,
         SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric as pass_rate,
         AVG(defect_count) as avg_defects,
         AVG(confidence_score) as avg_confidence
       FROM inspections
       ${whereClause}
       GROUP BY DATE(inspected_at)
       ORDER BY date ASC`,
      params
    );

    const passRates = dataResult.rows.map(r => parseFloat(r.pass_rate));
    const mean = passRates.length > 0
      ? passRates.reduce((a, b) => a + b, 0) / passRates.length
      : 0;

    const stdDev = passRates.length > 1
      ? Math.sqrt(passRates.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (passRates.length - 1))
      : 0;

    const ucl = Math.min(mean + 3 * stdDev, 1.0);
    const lcl = Math.max(mean - 3 * stdDev, 0.0);

    res.json({
      data: dataResult.rows,
      statistics: {
        mean: (mean * 100).toFixed(2),
        ucl: (ucl * 100).toFixed(2),
        lcl: (lcl * 100).toFixed(2),
        std_dev: (stdDev * 100).toFixed(2),
        sample_count: dataResult.rows.length,
      },
    });
  } catch (err) {
    console.error('Get SPC data error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

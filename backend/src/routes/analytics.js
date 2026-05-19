const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// GET /api/analytics/quality-trends
// Returns:
//   - Defect rate by production line over last 30 days (daily)
//   - Most common defect types (pie chart data)
//   - Quality score trend (7-day rolling average)
router.get('/quality-trends', auth, async (req, res) => {
  try {
    // 1. Defect rate by production line over last 30 days (daily)
    const defectRateByLine = await pool.query(
      `SELECT
         pl.id as production_line_id,
         pl.name as production_line_name,
         DATE(i.inspected_at) as date,
         COUNT(i.id) as total_inspections,
         SUM(i.defect_count) as total_defects,
         CASE WHEN COUNT(i.id) > 0
           THEN ROUND(SUM(i.defect_count)::numeric / COUNT(i.id)::numeric * 100, 2)
           ELSE 0
         END as defect_rate_pct
       FROM production_lines pl
       LEFT JOIN inspections i
         ON pl.id = i.production_line_id
         AND i.inspected_at >= NOW() - INTERVAL '30 days'
       WHERE i.id IS NOT NULL
       GROUP BY pl.id, pl.name, DATE(i.inspected_at)
       ORDER BY pl.name, date ASC`
    );

    // 2. Most common defect types (pie chart data)
    const defectTypes = await pool.query(
      `SELECT
         dl.name as defect_type,
         dl.category,
         dl.severity,
         COUNT(i.id) as count
       FROM defect_library dl
       JOIN inspections i ON i.defect_types::text LIKE '%' || dl.code || '%'
       WHERE i.inspected_at >= NOW() - INTERVAL '30 days'
       GROUP BY dl.id, dl.name, dl.category, dl.severity
       ORDER BY count DESC
       LIMIT 20`
    );

    // 3. Quality score trend: 7-day rolling average
    const qualityScoreTrend = await pool.query(
      `SELECT
         date,
         daily_avg_score,
         ROUND(
           AVG(daily_avg_score) OVER (
             ORDER BY date
             ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
           )::numeric, 2
         ) as rolling_7day_avg
       FROM (
         SELECT
           DATE(inspected_at) as date,
           ROUND(AVG(confidence_score)::numeric * 100, 2) as daily_avg_score
         FROM inspections
         WHERE inspected_at >= NOW() - INTERVAL '37 days'
         GROUP BY DATE(inspected_at)
       ) daily
       WHERE date >= NOW() - INTERVAL '30 days'
       ORDER BY date ASC`
    );

    res.json({
      defect_rate_by_line: defectRateByLine.rows,
      defect_types_breakdown: defectTypes.rows,
      quality_score_trend: qualityScoreTrend.rows,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Quality trends analytics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

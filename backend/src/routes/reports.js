const express = require('express');
const router = express.Router();
const pool = require('../db');
const PDFDocument = require('pdfkit');
const auth = require('../middleware/auth');

// GET /api/reports
router.get('/', auth, async (req, res) => {
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

// GET /api/reports/defects/pdf
// Generates a PDF report of defects within a date range
router.get('/defects/pdf', auth, async (req, res) => {
  try {
    const { date_from, date_to, production_line_id } = req.query;

    const fromDate = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = date_to || new Date().toISOString().split('T')[0];

    // Build where clause
    const params = [fromDate, toDate];
    let lineFilter = '';
    if (production_line_id) {
      params.push(production_line_id);
      lineFilter = `AND i.production_line_id = $${params.length}`;
    }

    // Summary stats
    const summaryResult = await pool.query(
      `SELECT
         COUNT(*) as total_inspections,
         SUM(defect_count) as total_defects,
         SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count,
         SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as fail_count,
         SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_count,
         ROUND(AVG(confidence_score)::numeric * 100, 2) as avg_confidence
       FROM inspections i
       WHERE DATE(inspected_at) BETWEEN $1 AND $2 ${lineFilter}`,
      params
    );

    // Defect type breakdown
    const defectBreakdownResult = await pool.query(
      `SELECT defect_types, COUNT(*) as count, SUM(defect_count) as total_defects
       FROM inspections i
       WHERE DATE(inspected_at) BETWEEN $1 AND $2 ${lineFilter}
         AND defect_count > 0
       GROUP BY defect_types
       ORDER BY total_defects DESC
       LIMIT 20`,
      params
    );

    // Top 10 most recent critical defects (alerts)
    const criticalParams = [fromDate, toDate];
    let criticalLineFilter = '';
    if (production_line_id) {
      criticalParams.push(production_line_id);
      criticalLineFilter = `AND a.production_line_id = $${criticalParams.length}`;
    }
    const criticalAlertsResult = await pool.query(
      `SELECT a.*, pl.name as production_line_name
       FROM alerts a
       LEFT JOIN production_lines pl ON a.production_line_id = pl.id
       WHERE a.severity = 'critical'
         AND DATE(a.created_at) BETWEEN $1 AND $2
         ${criticalLineFilter}
       ORDER BY a.created_at DESC
       LIMIT 10`,
      criticalParams
    );

    const summary = summaryResult.rows[0];
    const defectBreakdown = defectBreakdownResult.rows;
    const criticalAlerts = criticalAlertsResult.rows;

    // Build PDF
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="defects-report-${fromDate}-to-${toDate}.pdf"`
    );
    doc.pipe(res);

    // Title
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('Assembly Line Defects Report', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(11)
      .font('Helvetica')
      .text(`Date Range: ${fromDate} to ${toDate}`, { align: 'center' })
      .text(`Generated: ${new Date().toISOString()}`, { align: 'center' })
      .moveDown(1.5);

    // Summary
    doc.fontSize(15).font('Helvetica-Bold').text('Summary').moveDown(0.4);
    doc.fontSize(11).font('Helvetica');
    const totalInsp = parseInt(summary.total_inspections) || 0;
    const totalDefects = parseInt(summary.total_defects) || 0;
    const passCount = parseInt(summary.pass_count) || 0;
    const passRate = totalInsp > 0 ? ((passCount / totalInsp) * 100).toFixed(1) : '0';

    doc.text(`Total Inspections: ${totalInsp}`);
    doc.text(`Total Defects Found: ${totalDefects}`);
    doc.text(`Pass Count: ${passCount} (${passRate}%)`);
    doc.text(`Fail Count: ${parseInt(summary.fail_count) || 0}`);
    doc.text(`Warning Count: ${parseInt(summary.warning_count) || 0}`);
    doc.text(`Average Confidence Score: ${summary.avg_confidence || 0}%`);
    doc.moveDown(1.5);

    // Defect type breakdown
    doc.fontSize(15).font('Helvetica-Bold').text('Defect Type Breakdown').moveDown(0.4);
    if (defectBreakdown.length === 0) {
      doc.fontSize(11).font('Helvetica').text('No defects recorded in this period.');
    } else {
      const colX = [50, 300, 430];
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('Defect Types', colX[0], doc.y, { continued: false });
      const headerY = doc.y - doc.currentLineHeight();
      doc.text('Count', colX[1], headerY, { continued: false });
      doc.text('Total Defects', colX[2], headerY, { continued: false });
      doc.moveDown(0.2);
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown(0.2);

      doc.font('Helvetica').fontSize(10);
      defectBreakdown.forEach((row) => {
        const rowY = doc.y;
        const label = row.defect_types
          ? JSON.stringify(row.defect_types).substring(0, 40)
          : 'Unknown';
        doc.text(label, colX[0], rowY, { width: 240 });
        doc.text(String(row.count), colX[1], rowY);
        doc.text(String(row.total_defects), colX[2], rowY);
        doc.moveDown(0.4);
      });
    }
    doc.moveDown(1.5);

    // Top 10 critical alerts
    doc.fontSize(15).font('Helvetica-Bold').text('Top 10 Most Recent Critical Defects').moveDown(0.4);
    if (criticalAlerts.length === 0) {
      doc.fontSize(11).font('Helvetica').text('No critical defects recorded in this period.');
    } else {
      criticalAlerts.forEach((alert, i) => {
        doc.fontSize(11).font('Helvetica-Bold').text(`${i + 1}. ${alert.title}`);
        doc.fontSize(10).font('Helvetica');
        doc.text(`   Production Line: ${alert.production_line_name || 'N/A'}`);
        doc.text(`   Type: ${alert.type || 'N/A'}`);
        doc.text(`   Message: ${alert.message || 'N/A'}`);
        doc.text(`   Date: ${alert.created_at ? new Date(alert.created_at).toLocaleString() : 'N/A'}`);
        doc.text(`   Acknowledged: ${alert.acknowledged ? 'Yes' : 'No'}`);
        doc.moveDown(0.6);
      });
    }

    doc.end();
  } catch (err) {
    console.error('PDF report error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF report' });
    }
  }
});

// GET /api/reports/defects/csv
// Exports the defect summary as CSV (Excel-compatible).
router.get('/defects/csv', auth, async (req, res) => {
  try {
    const { date_from, date_to, production_line_id } = req.query;
    const fromDate = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = date_to || new Date().toISOString().split('T')[0];

    const params = [fromDate, toDate];
    let lineFilter = '';
    if (production_line_id) {
      params.push(production_line_id);
      lineFilter = `AND i.production_line_id = $${params.length}`;
    }

    const rows = await pool.query(
      `SELECT i.id, i.inspected_at, pl.name AS production_line, i.status,
              i.defect_count, i.confidence_score, i.defect_types
       FROM inspections i
       LEFT JOIN production_lines pl ON i.production_line_id = pl.id
       WHERE DATE(i.inspected_at) BETWEEN $1 AND $2 ${lineFilter}
       ORDER BY i.inspected_at DESC`,
      params
    );

    const escape = (val) => {
      if (val == null) return '';
      const s = typeof val === 'object' ? JSON.stringify(val) : String(val);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = ['inspection_id', 'inspected_at', 'production_line', 'status', 'defect_count', 'confidence_score', 'defect_types'];
    const lines = [header.join(',')];
    for (const r of rows.rows) {
      lines.push([
        r.id, r.inspected_at, r.production_line, r.status,
        r.defect_count, r.confidence_score, r.defect_types,
      ].map(escape).join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',
      `attachment; filename="defects-${fromDate}-to-${toDate}.csv"`);
    res.send(lines.join('\n'));
  } catch (err) {
    console.error('CSV report error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate CSV report' });
    }
  }
});

// GET /api/reports/:id
router.get('/:id', auth, async (req, res) => {
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
router.post('/', auth, async (req, res) => {
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
router.post('/generate', auth, async (req, res) => {
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
router.put('/:id', auth, async (req, res) => {
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
router.delete('/:id', auth, async (req, res) => {
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

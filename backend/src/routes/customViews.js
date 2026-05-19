const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../db');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer setup for inspect-image uploads
const UPLOAD_DIR = path.join(__dirname, '../../uploads/inspect');
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (_) {}
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image uploads are allowed'));
  },
});

// Deterministic-ish pseudo-random based on seed
function seeded(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// GET /api/custom-views/defect-heatmap
// Returns rows=stations, cols=last 7 days (YYYY-MM-DD), values=defect count
router.get('/defect-heatmap', auth, async (req, res) => {
  try {
    let stations = [];
    try {
      const result = await pool.query(
        "SELECT id, name FROM production_lines ORDER BY id ASC LIMIT 8"
      );
      stations = result.rows.map((r) => ({ id: r.id, name: r.name }));
    } catch (e) {
      // fall through to synthesized defaults
    }
    if (!stations.length) {
      stations = [
        { id: 1, name: 'SMT Line Alpha' },
        { id: 2, name: 'SMT Line Beta' },
        { id: 3, name: 'Final Assembly Line 1' },
        { id: 4, name: 'CNC Machining Cell A' },
        { id: 5, name: 'Injection Molding Line 1' },
        { id: 6, name: 'Paint & Coating Line' },
        { id: 7, name: 'Welding Robot Cell 1' },
      ];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const cells = stations.map((s, sIdx) => ({
      station_id: s.id,
      station_name: s.name,
      days: days.map((day, dIdx) => {
        const seed = (s.id || sIdx + 1) * 31 + dIdx * 7 + parseInt(day.replace(/-/g, ''), 10) % 97;
        const base = Math.floor(seeded(seed) * 18);
        const spike = (sIdx + dIdx) % 5 === 0 ? Math.floor(seeded(seed + 11) * 12) : 0;
        return { date: day, defect_count: base + spike };
      }),
    }));

    const maxDefects = cells.reduce((m, row) => {
      const localMax = row.days.reduce((mm, c) => Math.max(mm, c.defect_count), 0);
      return Math.max(m, localMax);
    }, 0);

    res.json({
      generated_at: new Date().toISOString(),
      days,
      stations: cells,
      max_defects: maxDefects,
    });
  } catch (err) {
    console.error('defect-heatmap error:', err);
    res.status(500).json({ error: 'Failed to build defect heatmap' });
  }
});

// GET /api/custom-views/throughput
// Returns units per hour for last 24 hours
router.get('/throughput', auth, async (req, res) => {
  try {
    const now = new Date();
    const points = [];
    for (let i = 23; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hour = t.getHours();
      const seed = t.getFullYear() * 1000 + t.getMonth() * 50 + t.getDate() * 24 + hour;
      // Day-shift pattern: higher 6-18h, lower at night
      const dayCurve = Math.sin(((hour - 6) / 24) * Math.PI * 2) * 180;
      const noise = (seeded(seed) - 0.5) * 80;
      const baseline = 620;
      const units = Math.max(120, Math.round(baseline + dayCurve + noise));
      points.push({
        timestamp: t.toISOString(),
        hour_label: t.toISOString().slice(11, 16),
        units_per_hour: units,
      });
    }

    const avg = Math.round(
      points.reduce((s, p) => s + p.units_per_hour, 0) / points.length
    );
    const peak = points.reduce((m, p) => Math.max(m, p.units_per_hour), 0);

    res.json({
      generated_at: new Date().toISOString(),
      window_hours: 24,
      average_uph: avg,
      peak_uph: peak,
      points,
    });
  } catch (err) {
    console.error('throughput error:', err);
    res.status(500).json({ error: 'Failed to build throughput series' });
  }
});

// POST /api/custom-views/defect-report
// Body: { station_id?, station_name?, start_date, end_date }
// Returns: application/pdf
router.post('/defect-report', auth, async (req, res) => {
  try {
    const { station_id, station_name, start_date, end_date } = req.body || {};
    const stationLabel = station_name || (station_id ? `Station #${station_id}` : 'All Stations');
    const periodStart = start_date || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const periodEnd = end_date || new Date().toISOString().slice(0, 10);

    // Synthesize report data (deterministic by station/period)
    const periodKey = `${stationLabel}|${periodStart}|${periodEnd}`;
    let seedNum = 0;
    for (let i = 0; i < periodKey.length; i++) seedNum = (seedNum * 31 + periodKey.charCodeAt(i)) % 100000;
    const rnd = (n) => {
      const x = Math.sin(seedNum + n) * 10000;
      return x - Math.floor(x);
    };

    const totalDefects = 40 + Math.floor(rnd(1) * 220);
    const defectTypes = ['Solder Bridge', 'Missing Component', 'Misalignment', 'Surface Scratch', 'Color Mismatch', 'Dimensional Error'];
    const topTypes = defectTypes
      .map((t, i) => ({ type: t, count: Math.floor(rnd(2 + i) * (totalDefects / 2)) + 1 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const severityCounts = {
      critical: Math.floor(totalDefects * (0.05 + rnd(7) * 0.1)),
      high:     Math.floor(totalDefects * (0.10 + rnd(8) * 0.10)),
      medium:   Math.floor(totalDefects * (0.20 + rnd(9) * 0.15)),
      low:      Math.floor(totalDefects * (0.20 + rnd(10) * 0.20)),
    };
    const recommendations = [
      `Increase QC inspection frequency on ${stationLabel} during peak shifts.`,
      `Recalibrate vision system thresholds for ${topTypes[0]?.type || 'top defect type'}.`,
      'Schedule preventive maintenance for affected tooling within 7 days.',
      'Run operator refresher training focused on highest-frequency defects.',
      'Audit upstream material lot inspection records for correlated trends.',
    ];

    // Stream PDF
    const filename = `defect_report_${stationLabel.replace(/\s+/g, '_')}_${periodStart}_${periodEnd}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // Header
    doc.fillColor('#0f172a').fontSize(22).text('Defect Report', { align: 'left' });
    doc.moveDown(0.3);
    doc.fillColor('#475569').fontSize(11).text('AI Assembly Line Visual Inspector', { align: 'left' });
    doc.moveTo(50, doc.y + 6).lineTo(545, doc.y + 6).strokeColor('#cbd5e1').stroke();
    doc.moveDown(1.2);

    // Meta
    doc.fillColor('#0f172a').fontSize(12).text(`Station: `, { continued: true }).fillColor('#1e293b').text(stationLabel);
    doc.fillColor('#0f172a').text(`Period: `, { continued: true }).fillColor('#1e293b').text(`${periodStart} to ${periodEnd}`);
    doc.fillColor('#0f172a').text(`Generated: `, { continued: true }).fillColor('#1e293b').text(new Date().toISOString());
    doc.moveDown(0.8);

    // Summary
    doc.fillColor('#0f172a').fontSize(14).text('Summary');
    doc.moveDown(0.3);
    doc.fillColor('#1e293b').fontSize(12).text(`Total Defects: ${totalDefects}`);
    doc.text(`Critical: ${severityCounts.critical}    High: ${severityCounts.high}    Medium: ${severityCounts.medium}    Low: ${severityCounts.low}`);
    doc.moveDown(0.8);

    // Top defect types
    doc.fillColor('#0f172a').fontSize(14).text('Top Defect Types');
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#1e293b');
    topTypes.forEach((t, idx) => {
      const pct = ((t.count / Math.max(1, totalDefects)) * 100).toFixed(1);
      doc.text(`${idx + 1}. ${t.type} - ${t.count} (${pct}%)`);
    });
    doc.moveDown(0.8);

    // Severity breakdown
    doc.fillColor('#0f172a').fontSize(14).text('Severity Breakdown');
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#1e293b');
    Object.entries(severityCounts).forEach(([sev, count]) => {
      doc.text(`- ${sev.toUpperCase()}: ${count}`);
    });
    doc.moveDown(0.8);

    // Recommendations
    doc.fillColor('#0f172a').fontSize(14).text('Recommended Actions');
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#1e293b');
    recommendations.forEach((r, idx) => {
      doc.text(`${idx + 1}. ${r}`);
    });

    doc.moveDown(2);
    doc.fillColor('#64748b').fontSize(9).text(`Report ID: DR-${Date.now()}`, { align: 'right' });

    doc.end();
  } catch (err) {
    console.error('defect-report error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate defect report' });
  }
});

// POST /api/custom-views/inspect-image
// multipart/form-data: image (file)
// Returns mock AI inspection result
router.post('/inspect-image', auth, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded (field name: image)' });
    }
    const seed = (req.file.size || 1) + (req.file.originalname || '').length;
    const r = (n) => {
      const x = Math.sin(seed + n) * 10000;
      return x - Math.floor(x);
    };

    const verdict = r(1) > 0.45 ? 'pass' : 'fail';
    const defectCatalog = ['surface_scratch', 'solder_bridge', 'missing_component', 'misalignment', 'color_mismatch'];
    let defects = [];
    if (verdict === 'fail') {
      const count = 1 + Math.floor(r(2) * 3);
      for (let i = 0; i < count; i++) {
        const type = defectCatalog[Math.floor(r(3 + i) * defectCatalog.length)];
        defects.push({
          type,
          confidence: Math.round((0.55 + r(10 + i) * 0.43) * 100) / 100,
          bbox: {
            x: Math.round(r(20 + i) * 60),
            y: Math.round(r(30 + i) * 60),
            w: Math.round(15 + r(40 + i) * 30),
            h: Math.round(15 + r(50 + i) * 30),
          },
        });
      }
    }

    res.json({
      verdict,
      defects,
      processed_at: new Date().toISOString(),
      image: {
        original_name: req.file.originalname,
        stored_name: req.file.filename,
        size_bytes: req.file.size,
        url: `/uploads/inspect/${req.file.filename}`,
      },
      model: 'mock-vision-inspector-v0.1',
    });
  } catch (err) {
    console.error('inspect-image error:', err);
    res.status(500).json({ error: 'Failed to process image inspection' });
  }
});

module.exports = router;

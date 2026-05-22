const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    feature: 'Golden Sample Calibration',
    summary: { camerasChecked: 18, driftDetected: 3, samplesDue: 5, falseRejectRisk: 2 },
    stations: [
      { line: 'Line A', camera: 'CAM-A3', sample: 'GS-441', drift: '0.8 mm edge offset', status: 'recalibrate', action: 'Run golden sample before next batch' },
      { line: 'Line B', camera: 'CAM-B1', sample: 'GS-118', drift: 'none', status: 'ready', action: 'Continue production' },
      { line: 'Line C', camera: 'CAM-C2', sample: 'GS-207', drift: 'lighting variance', status: 'watch', action: 'Clean lens and retest exposure' }
    ],
    checks: ['Lens focus', 'Lighting histogram', 'Fixture alignment', 'Model confidence baseline', 'False reject rate']
  });
});

module.exports = router;

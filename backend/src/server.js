const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const { default: rateLimit, ipKeyGenerator } = require('express-rate-limit');
const pool = require('./db');

const authRoutes = require('./routes/auth');
const productionLinesRoutes = require('./routes/productionLines');
const cameraFeedsRoutes = require('./routes/cameraFeeds');
const inspectionsRoutes = require('./routes/inspections');
const productsRoutes = require('./routes/products');
const defectLibraryRoutes = require('./routes/defectLibrary');
const operatorsRoutes = require('./routes/operators');
const alertsRoutes = require('./routes/alerts');
const batchesRoutes = require('./routes/batches');
const qualityMetricsRoutes = require('./routes/qualityMetrics');
const reportsRoutes = require('./routes/reports');
const shiftsRoutes = require('./routes/shifts');
const aiAnalysisRoutes = require('./routes/aiAnalysis');
const dashboardRoutes = require('./routes/dashboard');
const downtimeRoutes = require('./routes/downtime');
const maintenanceRoutes = require('./routes/maintenance');
const auditTrailRoutes = require('./routes/auditTrail');
const usersRoutes = require('./routes/users');
const inventoryRoutes = require('./routes/inventory');
const trainingRoutes = require('./routes/training');
const qualityGoalsRoutes = require('./routes/qualityGoals');
const workOrdersRoutes = require('./routes/workOrders');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const httpServer = http.createServer(app);

// Build allowed CORS origins from env
const buildAllowedOrigins = () => {
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  }
  if (process.env.FRONTEND_URL) return [process.env.FRONTEND_URL];
  const port = process.env.FRONTEND_PORT || 3000;
  return [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
};
const ALLOWED_ORIGINS = buildAllowedOrigins();

// Socket.IO setup with restricted CORS
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
});

// Attach io to app so routes can access it
app.set('io', io);

io.on('connection', (socket) => {
  console.log('Socket client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Socket client disconnected:', socket.id);
  });
});

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS — env-driven allowlist
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// General rate limiter: 100 requests per IP per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI rate limiter: 20 requests per user per hour
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  keyGenerator: (req) => {
    // Use user id from JWT if present, else fall back to IP (using helper for IPv6 safety)
    if (req.user) return String(req.user.id || req.user.userId);
    return ipKeyGenerator(req);
  },
  message: { error: 'Too many AI requests. Limit is 20 per hour per user.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Best-effort runtime migration: ensure ai_results JSONB table exists.
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_results (
        id SERIAL PRIMARY KEY,
        feature VARCHAR(100) NOT NULL,
        user_id INTEGER,
        entity_type VARCHAR(50),
        entity_id INTEGER,
        prompt_summary TEXT,
        result JSONB NOT NULL DEFAULT '{}'::jsonb,
        model VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ai_results_feature ON ai_results (feature);
      CREATE INDEX IF NOT EXISTS idx_ai_results_user ON ai_results (user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_results_entity ON ai_results (entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_ai_results_created ON ai_results (created_at DESC);

      CREATE TABLE IF NOT EXISTS defect_analyses (
        id SERIAL PRIMARY KEY,
        image_path VARCHAR(500),
        defect_type VARCHAR(100),
        location VARCHAR(255),
        severity VARCHAR(50),
        affected_component VARCHAR(255),
        confidence_score NUMERIC,
        recommended_action TEXT,
        raw_result JSONB,
        analyzed_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
  } catch (err) {
    console.warn('[ai_results] runtime migration skipped:', err.message);
  }
})();

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', generalLimiter, authRoutes);
app.use('/api/production-lines', generalLimiter, productionLinesRoutes);
app.use('/api/camera-feeds', generalLimiter, cameraFeedsRoutes);
app.use('/api/inspections', generalLimiter, inspectionsRoutes);
app.use('/api/products', generalLimiter, productsRoutes);
app.use('/api/defect-library', generalLimiter, defectLibraryRoutes);
app.use('/api/operators', generalLimiter, operatorsRoutes);
app.use('/api/alerts', generalLimiter, alertsRoutes);
app.use('/api/batches', generalLimiter, batchesRoutes);
app.use('/api/quality-metrics', generalLimiter, qualityMetricsRoutes);
app.use('/api/reports', generalLimiter, reportsRoutes);
app.use('/api/shifts', generalLimiter, shiftsRoutes);
app.use('/api/ai', aiRateLimiter, aiAnalysisRoutes);
app.use('/api/dashboard', generalLimiter, dashboardRoutes);
app.use('/api/downtime', generalLimiter, downtimeRoutes);
app.use('/api/maintenance', generalLimiter, maintenanceRoutes);
app.use('/api/audit-trail', generalLimiter, auditTrailRoutes);
app.use('/api/users', generalLimiter, usersRoutes);
app.use('/api/inventory', generalLimiter, inventoryRoutes);
app.use('/api/training', generalLimiter, trainingRoutes);
app.use('/api/quality-goals', generalLimiter, qualityGoalsRoutes);
app.use('/api/work-orders', generalLimiter, workOrdersRoutes);
app.use('/api/analytics', generalLimiter, analyticsRoutes);
app.use('/api/custom-views', generalLimiter, require('./routes/customViews'));
app.use('/api/golden-sample-calibration', generalLimiter, require('./routes/goldenSampleCalibration'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.BACKEND_PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});

module.exports = { app, io };

// BATCH_00_AUDIT_MOUNTS
app.use('/api/defect-vision', require('./routes/defectVision'));
app.use('/api/spc-stream', require('./routes/spcStream'));
app.use('/api/quality-maintenance', require('./routes/qualityMaintenance'));
app.use('/api/operator-coaching', require('./routes/operatorCoaching'));
app.use('/api/mes-bridge', require('./routes/mesBridge'));

// === Batch 00 Gaps & Frontend Mounts ===
app.use('/api/gap-ai-defect-detection-computer-vision', require('./routes/gap_ai_defect_detection_computer_vision'));
app.use('/api/gap-ai-quality-prediction-batch-pass', require('./routes/gap_ai_quality_prediction_batch_pass'));
app.use('/api/gap-ai-root-cause-analysis-defect', require('./routes/gap_ai_root_cause_analysis_defect'));
app.use('/api/gap-ai-streaming-sensor-anomaly-detection', require('./routes/gap_ai_streaming_sensor_anomaly_detection'));
app.use('/api/gap-ai-scrap-rate-optimization', require('./routes/gap_ai_scrap_rate_optimization'));
app.use('/api/gap-mes-parsec-plex-wonderware-integration', require('./routes/gap_mes_parsec_plex_wonderware_integration'));
app.use('/api/gap-real-time-spc-streaming-alerts', require('./routes/gap_real_time_spc_streaming_alerts'));
app.use('/api/gap-operator-skill-levelling-certification-ladder', require('./routes/gap_operator_skill_levelling_certification_ladder'));
app.use('/api/gap-outbound-webhooks', require('./routes/gap_outbound_webhooks'));

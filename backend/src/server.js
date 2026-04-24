const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');

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

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/production-lines', productionLinesRoutes);
app.use('/api/camera-feeds', cameraFeedsRoutes);
app.use('/api/inspections', inspectionsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/defect-library', defectLibraryRoutes);
app.use('/api/operators', operatorsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/batches', batchesRoutes);
app.use('/api/quality-metrics', qualityMetricsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/ai', aiAnalysisRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/downtime', downtimeRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/audit-trail', auditTrailRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/quality-goals', qualityGoalsRoutes);
app.use('/api/work-orders', workOrdersRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.BACKEND_PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

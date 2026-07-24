const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;

router.get('/demo-credentials', (_req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEMO_CREDENTIAL_AUTOFILL === 'false') return res.sendStatus(404);
  const pairs = [
    [process.env.PROVISION_ADMIN_EMAIL, process.env.PROVISION_ADMIN_PASSWORD],
    [process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD],
    [process.env.DEMO_EMAIL, process.env.DEMO_PASSWORD],
    [process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD],
  ];
  const credentials = pairs.find(([email, password]) => email && password);
  if (!credentials) return res.sendStatus(404);
  res.set('Cache-Control', 'no-store').json({ email: credentials[0], password: credentials[1] });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    if (!JWT_SECRET) {
      return res.status(503).json({ error: 'Authentication is not configured' });
    }
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

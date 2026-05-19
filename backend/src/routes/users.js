const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');

function validateUser(body, isCreate = false) {
  const errors = [];
  if (!body.name || !String(body.name).trim()) errors.push('name is required');
  if (!body.email || !String(body.email).trim()) errors.push('email is required');
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.push('email format is invalid');
  if (isCreate && (!body.password || String(body.password).length < 6)) errors.push('password must be at least 6 characters');
  const roles = ['admin', 'operator', 'viewer', 'quality_manager'];
  if (body.role && !roles.includes(body.role)) errors.push(`role must be one of: ${roles.join(', ')}`);
  return errors;
}

// GET /api/users
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', auth, async (req, res) => {
  const errs = validateUser(req.body, true);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at`,
      [name, email, hashedPassword, role || 'viewer']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    let result;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      result = await pool.query(
        `UPDATE users SET name = $1, email = $2, password = $3, role = $4 WHERE id = $5
         RETURNING id, name, email, role, created_at`,
        [name, email, hashedPassword, role, req.params.id]
      );
    } else {
      result = await pool.query(
        `UPDATE users SET name = $1, email = $2, role = $3 WHERE id = $4
         RETURNING id, name, email, role, created_at`,
        [name, email, role, req.params.id]
      );
    }
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, name, email, role, created_at', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

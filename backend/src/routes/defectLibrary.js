const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/defect-library
router.get('/', async (req, res) => {
  try {
    const { category, severity } = req.query;
    let query = 'SELECT * FROM defect_library';
    const params = [];
    const conditions = [];

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (severity) {
      params.push(severity);
      conditions.push(`severity = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get defect library error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/defect-library/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM defect_library WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Defect type not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get defect type error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/defect-library
router.post('/', async (req, res) => {
  try {
    const { name, code, category, severity, description, detection_method, corrective_action, reference_image_url } = req.body;
    const result = await pool.query(
      `INSERT INTO defect_library (name, code, category, severity, description, detection_method, corrective_action, reference_image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, code, category, severity, description, detection_method, corrective_action, reference_image_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create defect type error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/defect-library/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, code, category, severity, description, detection_method, corrective_action, reference_image_url } = req.body;
    const result = await pool.query(
      `UPDATE defect_library SET name = $1, code = $2, category = $3, severity = $4, description = $5,
       detection_method = $6, corrective_action = $7, reference_image_url = $8 WHERE id = $9 RETURNING *`,
      [name, code, category, severity, description, detection_method, corrective_action, reference_image_url, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Defect type not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update defect type error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/defect-library/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM defect_library WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Defect type not found' });
    }
    res.json({ message: 'Defect type deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Delete defect type error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

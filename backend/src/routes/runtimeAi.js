'use strict';

const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/inspection-readiness', auth, async (req, res) => {
  try {
    const baseUrl = process.env.OPENROUTER_BASE_URL;
    const model = process.env.OPENROUTER_MODEL;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (baseUrl !== 'https://openrouter.ai/api/v1' || !model || !apiKey) return res.status(503).json({ error: 'Canonical OpenRouter configuration is required' });
    const context = String(req.body?.context || 'Assess a visual inspection station for production-line quality readiness.').slice(0, 4000);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [
        { role: 'system', content: 'You are a manufacturing quality engineer assistant. Return concise inspection risks, calibration and evidence gaps, and safe next actions.' },
        { role: 'user', content: context },
      ], temperature: 0.2, max_tokens: 600 }),
    });
    const provider = await response.json();
    if (!response.ok || provider.error) throw new Error(provider.error?.message || `OpenRouter HTTP ${response.status}`);
    const content = provider.choices?.[0]?.message?.content;
    if (!provider.id || typeof content !== 'string' || !content.trim()) throw new Error('OpenRouter returned an incomplete provider response');
    const receipt = { id: provider.id, model: provider.model || model, usage: provider.usage || null };
    const stored = await pool.query(
      `INSERT INTO runtime_ai_results (user_id, feature, input, content, model, provider_receipt)
       VALUES ($1, 'inspection-readiness', $2, $3, $4, $5) RETURNING id, created_at`,
      [req.user.id, { context }, content, receipt.model, receipt]
    );
    res.json({ success: true, content, model: receipt.model, providerReceipt: receipt, resultId: stored.rows[0].id, persistedAt: stored.rows[0].created_at });
  } catch (error) {
    console.error('[runtime-ai] inspection-readiness failed:', error.message);
    res.status(502).json({ error: 'OpenRouter inspection readiness failed' });
  }
});

module.exports = router;

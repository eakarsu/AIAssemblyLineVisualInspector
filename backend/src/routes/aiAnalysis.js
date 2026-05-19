const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const auth = require('../middleware/auth');
const { parseAIJson } = require('../parseAIJson');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'anthropic/claude-3-5-sonnet-20241022';

const userId = (req) => req.user ? (req.user.id || req.user.userId || null) : null;

// Persist an AI result to ai_results JSONB table — best-effort.
async function persistAIResult({ feature, user_id, entity_type, entity_id, prompt_summary, result, model }) {
  try {
    const insert = await pool.query(
      `INSERT INTO ai_results (feature, user_id, entity_type, entity_id, prompt_summary, result, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
      [
        feature,
        user_id || null,
        entity_type || null,
        entity_id || null,
        prompt_summary || null,
        JSON.stringify(result || {}),
        model || DEFAULT_MODEL,
      ]
    );
    return insert.rows[0];
  } catch (err) {
    console.warn('[ai_results] persist skipped:', err.message);
    return null;
  }
}

// Multer config for image uploads
const upload = multer({
  dest: path.join(__dirname, '../../uploads/ai-images/'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Sanitize user-provided strings before sending to the AI: strip control chars
// and cap length to prevent prompt-injection bombs / overrun.
function sanitizeForPrompt(value, maxLen = 8000) {
  if (value == null) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  // Remove null bytes / unprintable control chars (preserve \n and \t)
  const cleaned = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '...[truncated]' : cleaned;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callOpenRouter(systemPrompt, userMessage, retries = 2) {
  const safeUser = sanitizeForPrompt(userMessage);
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: safeUser },
          ],
          temperature: 0.3,
        }),
      });

      const data = await response.json();

      if (data.error) {
        // Retry only on transient (5xx-ish or rate-limit) errors.
        const code = data.error.code || data.error.status || response.status;
        if ((code === 429 || (code >= 500 && code < 600)) && attempt < retries) {
          await sleep(500 * Math.pow(2, attempt));
          continue;
        }
        throw new Error(data.error.message || 'OpenRouter API error');
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('No response from AI model');

      const parsed = parseAIJson(content);
      return parsed.ok ? parsed.data : { analysis: content };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(500 * Math.pow(2, attempt));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr;
}

async function callOpenRouterWithVision(messages) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.3,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'OpenRouter API error');
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI model');
  }

  const parsed = parseAIJson(content);
  return parsed.ok ? parsed.data : { analysis: content };
}

// POST /api/ai/detect-defects
router.post('/detect-defects', auth, async (req, res) => {
  try {
    const { image_description, product_type, inspection_context } = req.body;

    const systemPrompt = `You are an expert visual quality inspector for manufacturing assembly lines. You specialize in detecting defects in manufactured products using visual inspection techniques.

Your task is to analyze the described image/product and identify any defects. You must respond with a JSON object containing:
- "defects_found": boolean
- "defect_count": number
- "defects": array of objects with { "type": string, "severity": "critical"|"major"|"minor", "location": string, "confidence": number (0-1), "description": string }
- "overall_quality": "pass"|"fail"|"warning"
- "confidence_score": number (0-1)
- "recommendations": array of strings

Be precise and thorough. Consider surface defects, dimensional issues, color inconsistencies, structural problems, and cosmetic imperfections. Always respond with valid JSON only.`;

    const userMessage = `Product type: ${product_type || 'General manufactured product'}
Inspection context: ${inspection_context || 'Standard quality inspection'}

Image/Product description:
${image_description}

Analyze this for defects and provide your assessment.`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    await persistAIResult({
      feature: 'detect-defects',
      user_id: userId(req),
      entity_type: 'product',
      entity_id: null,
      prompt_summary: (image_description || '').slice(0, 200),
      result,
    });
    res.json(result);
  } catch (err) {
    console.error('Detect defects error:', err);
    res.status(500).json({ error: err.message || 'AI analysis failed' });
  }
});

// POST /api/ai/classify-defect
router.post('/classify-defect', auth, async (req, res) => {
  try {
    const { defect_description, product_type, additional_context } = req.body;

    const systemPrompt = `You are a manufacturing quality control expert specializing in defect classification. You categorize defects according to industry standards.

Classify the described defect and respond with a JSON object containing:
- "classification": { "category": "surface"|"structural"|"dimensional"|"cosmetic"|"functional", "severity": "critical"|"major"|"minor", "defect_code": string }
- "root_cause_likelihood": array of { "cause": string, "probability": number (0-1) }
- "impact_assessment": { "safety_risk": "high"|"medium"|"low"|"none", "functional_impact": string, "customer_impact": string }
- "corrective_actions": array of strings
- "preventive_measures": array of strings

Always respond with valid JSON only.`;

    const userMessage = `Product type: ${product_type || 'General manufactured product'}
Additional context: ${additional_context || 'None'}

Defect description:
${defect_description}

Classify this defect and provide your assessment.`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    await persistAIResult({
      feature: 'classify-defect',
      user_id: userId(req),
      entity_type: 'defect',
      entity_id: null,
      prompt_summary: (defect_description || '').slice(0, 200),
      result,
    });
    res.json(result);
  } catch (err) {
    console.error('Classify defect error:', err);
    res.status(500).json({ error: err.message || 'AI classification failed' });
  }
});

// POST /api/ai/quality-prediction
router.post('/quality-prediction', auth, async (req, res) => {
  try {
    const { historical_data, production_parameters, time_horizon } = req.body;

    const systemPrompt = `You are a predictive quality analytics expert for manufacturing. You analyze historical quality data and production parameters to predict future quality trends.

Based on the provided data, respond with a JSON object containing:
- "prediction": { "expected_pass_rate": number, "trend": "improving"|"stable"|"declining", "confidence": number (0-1) }
- "risk_factors": array of { "factor": string, "risk_level": "high"|"medium"|"low", "description": string }
- "forecasted_issues": array of { "issue": string, "probability": number (0-1), "expected_timeframe": string }
- "optimization_suggestions": array of { "suggestion": string, "expected_improvement": string, "priority": "high"|"medium"|"low" }
- "key_metrics_forecast": { "defect_rate": number, "throughput_impact": string, "cost_impact": string }

Always respond with valid JSON only.`;

    const userMessage = `Historical quality data: ${JSON.stringify(historical_data || {})}
Production parameters: ${JSON.stringify(production_parameters || {})}
Prediction time horizon: ${time_horizon || '7 days'}

Analyze the data and provide quality predictions.`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    await persistAIResult({
      feature: 'quality-prediction',
      user_id: userId(req),
      entity_type: 'production_line',
      entity_id: null,
      prompt_summary: `horizon=${time_horizon || '7 days'}`,
      result,
    });
    res.json(result);
  } catch (err) {
    console.error('Quality prediction error:', err);
    res.status(500).json({ error: err.message || 'AI prediction failed' });
  }
});

// POST /api/ai/root-cause
router.post('/root-cause', auth, async (req, res) => {
  try {
    const { defect_data, process_parameters, environmental_conditions, machine_data } = req.body;

    const systemPrompt = `You are a root cause analysis expert in manufacturing quality engineering. You use methodologies like 5 Whys, Fishbone diagrams, and FMEA to identify root causes of defects.

Analyze the provided defect information and respond with a JSON object containing:
- "root_causes": array of { "cause": string, "category": "man"|"machine"|"method"|"material"|"measurement"|"environment", "confidence": number (0-1), "evidence": string }
- "five_whys_analysis": array of { "level": number, "question": string, "answer": string }
- "contributing_factors": array of { "factor": string, "contribution_level": "primary"|"secondary"|"tertiary" }
- "corrective_actions": array of { "action": string, "type": "immediate"|"short_term"|"long_term", "responsible_party": string, "expected_outcome": string }
- "verification_steps": array of strings

Always respond with valid JSON only.`;

    const userMessage = `Defect data: ${JSON.stringify(defect_data || {})}
Process parameters: ${JSON.stringify(process_parameters || {})}
Environmental conditions: ${JSON.stringify(environmental_conditions || {})}
Machine data: ${JSON.stringify(machine_data || {})}

Perform a root cause analysis for the described quality issue.`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    await persistAIResult({
      feature: 'root-cause',
      user_id: userId(req),
      entity_type: 'defect',
      entity_id: null,
      prompt_summary: 'root cause analysis',
      result,
    });
    res.json(result);
  } catch (err) {
    console.error('Root cause analysis error:', err);
    res.status(500).json({ error: err.message || 'AI root cause analysis failed' });
  }
});

// POST /api/ai/recommendations
router.post('/recommendations', auth, async (req, res) => {
  try {
    const { quality_data, production_context, current_issues, goals } = req.body;

    const systemPrompt = `You are a manufacturing process improvement consultant specializing in quality management systems (ISO 9001, Six Sigma, Lean Manufacturing).

Based on the provided quality data and production context, respond with a JSON object containing:
- "recommendations": array of { "title": string, "description": string, "category": "process"|"equipment"|"training"|"material"|"design", "priority": "critical"|"high"|"medium"|"low", "estimated_impact": string, "implementation_effort": "high"|"medium"|"low", "timeline": string }
- "quick_wins": array of { "action": string, "expected_result": string }
- "long_term_strategy": { "vision": string, "milestones": array of { "milestone": string, "timeframe": string } }
- "kpi_targets": array of { "metric": string, "current_value": string, "target_value": string, "improvement_percentage": number }
- "risk_mitigation": array of { "risk": string, "mitigation": string }

Always respond with valid JSON only.`;

    const userMessage = `Quality data summary: ${JSON.stringify(quality_data || {})}
Production context: ${JSON.stringify(production_context || {})}
Current issues: ${JSON.stringify(current_issues || [])}
Improvement goals: ${JSON.stringify(goals || [])}

Provide actionable recommendations for quality improvement.`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    await persistAIResult({
      feature: 'recommendations',
      user_id: userId(req),
      entity_type: 'quality',
      entity_id: null,
      prompt_summary: 'quality recommendations',
      result,
    });
    res.json(result);
  } catch (err) {
    console.error('Recommendations error:', err);
    res.status(500).json({ error: err.message || 'AI recommendations failed' });
  }
});

// POST /api/ai/analyze-image
// Accepts multipart form data with an image file, calls OpenRouter vision API
router.post('/analyze-image', auth, upload.single('image'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    filePath = req.file.path;
    const imageBuffer = fs.readFileSync(filePath);
    const base64Data = imageBuffer.toString('base64');
    const mediaType = req.file.mimetype || 'image/jpeg';

    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: `You are an expert quality control AI for manufacturing. Analyze this assembly line image and identify any defects or quality issues.

Respond with a JSON object containing:
- "defect_type": string (primary defect type found, or "none")
- "location": string (where in the image the defect is located)
- "severity": "critical"|"major"|"minor"|"none"
- "affected_component": string
- "confidence_score": number (0-100)
- "recommended_action": string
- "additional_defects": array of any secondary defects found
- "overall_assessment": string

Always respond with valid JSON only.`,
          },
        ],
      },
    ];

    const result = await callOpenRouterWithVision(messages);

    // Save result to defect_analyses table
    let savedAnalysis = null;
    try {
      const insertResult = await pool.query(
        `INSERT INTO defect_analyses
           (image_path, defect_type, location, severity, affected_component, confidence_score, recommended_action, raw_result, analyzed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          req.file.originalname || req.file.filename,
          result.defect_type || null,
          result.location || null,
          result.severity || null,
          result.affected_component || null,
          result.confidence_score || null,
          result.recommended_action || null,
          JSON.stringify(result),
          req.user ? (req.user.id || req.user.userId) : null,
        ]
      );
      savedAnalysis = insertResult.rows[0];
    } catch (dbErr) {
      // Table may not exist yet; log but don't fail the response
      console.warn('[analyze-image] Could not save to defect_analyses table:', dbErr.message);
    }

    await persistAIResult({
      feature: 'analyze-image',
      user_id: userId(req),
      entity_type: 'image',
      entity_id: savedAnalysis ? savedAnalysis.id : null,
      prompt_summary: req.file ? (req.file.originalname || req.file.filename) : 'image',
      result,
    });

    res.json({ success: true, analysis: result, saved: savedAnalysis });
  } catch (err) {
    console.error('Analyze image error:', err);
    res.status(500).json({ error: err.message || 'Image analysis failed' });
  } finally {
    // Clean up temp file
    if (filePath) {
      fs.unlink(filePath, () => {});
    }
  }
});

// POST /api/ai/predict-quality
// Takes { production_line_id, current_metrics } and predicts quality drop in next 2 hours
router.post('/predict-quality', auth, async (req, res) => {
  try {
    const { production_line_id, current_metrics } = req.body;

    if (!production_line_id) {
      return res.status(400).json({ error: 'production_line_id is required' });
    }

    // Query last 100 quality scores for this line
    const historyResult = await pool.query(
      `SELECT confidence_score, status, defect_count, inspected_at
       FROM inspections
       WHERE production_line_id = $1
       ORDER BY inspected_at DESC
       LIMIT 100`,
      [production_line_id]
    );

    const qualityHistory = historyResult.rows;

    const systemPrompt = `You are a predictive quality analytics AI for manufacturing assembly lines. You analyze recent quality score history and current production metrics to predict whether quality will drop in the next 2 hours.

Respond with a JSON object containing:
- "will_quality_drop": boolean
- "confidence": number (0-100, percent confidence in your prediction)
- "predicted_severity": "none"|"minor"|"moderate"|"severe"
- "key_indicators": array of strings explaining why you made this prediction
- "recommended_actions": array of strings
- "predicted_defect_rate": number (expected defect rate as a percentage)
- "time_to_action": string (how soon action should be taken)

Always respond with valid JSON only.`;

    const userMessage = `Production Line ID: ${production_line_id}

Current metrics:
${JSON.stringify(current_metrics || {}, null, 2)}

Last ${qualityHistory.length} inspection records (most recent first):
${JSON.stringify(qualityHistory, null, 2)}

Based on these metrics and history, predict if quality will drop in the next 2 hours.`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    await persistAIResult({
      feature: 'predict-quality',
      user_id: userId(req),
      entity_type: 'production_line',
      entity_id: parseInt(production_line_id, 10) || null,
      prompt_summary: `2-hour quality prediction for line ${production_line_id}`,
      result,
    });
    res.json({ success: true, production_line_id, prediction: result });
  } catch (err) {
    console.error('Predict quality error:', err);
    res.status(500).json({ error: err.message || 'Quality prediction failed' });
  }
});

// ══════════════════════════════════════════════════════════════
// Audit-driven NEW AI features
// ══════════════════════════════════════════════════════════════

// POST /api/ai/defect-trend-forecast
// Time-series analysis of defect rates per line/product type.
router.post('/defect-trend-forecast', auth, async (req, res) => {
  try {
    const { production_line_id, product_type, lookback_days } = req.body;

    let history = [];
    if (production_line_id) {
      try {
        const r = await pool.query(
          `SELECT inspected_at, defect_count, status
           FROM inspections
           WHERE production_line_id = $1
             AND inspected_at >= NOW() - ($2::int || ' days')::interval
           ORDER BY inspected_at ASC`,
          [production_line_id, lookback_days || 30]
        );
        history = r.rows;
      } catch (_) { /* ignore if column missing */ }
    }

    const systemPrompt = `You are a quality time-series analyst. Forecast the next defect spike and recommend preventive maintenance windows. Always respond with valid JSON only.

Respond with:
- forecast: array of { day_offset, predicted_defect_rate, confidence }
- next_predicted_spike: { days_from_now, predicted_severity, root_cause_hypothesis }
- preventive_maintenance_window: { recommended_start, recommended_end, rationale }
- key_drivers: array of strings`;

    const userMessage = `Production line: ${production_line_id || 'all'}
Product type: ${product_type || 'general'}
Lookback days: ${lookback_days || 30}

History (oldest first, last ${history.length} samples):
${JSON.stringify(history.slice(-200))}`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    await persistAIResult({
      feature: 'defect-trend-forecast',
      user_id: userId(req),
      entity_type: 'production_line',
      entity_id: parseInt(production_line_id, 10) || null,
      prompt_summary: `${product_type || 'general'} ${lookback_days || 30}d`,
      result,
    });
    res.json({ success: true, prediction: result, samples_used: history.length });
  } catch (err) {
    console.error('defect-trend-forecast error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/operator-scorecard
// Scorecard per operator across shifts; AI ranks defect-finding skill.
router.post('/operator-scorecard', auth, async (req, res) => {
  try {
    const { operator_id, period_days } = req.body;

    let stats = [];
    try {
      const params = operator_id ? [operator_id, period_days || 30] : [period_days || 30];
      const where = operator_id ? 'WHERE operator_id = $1' : '';
      const intervalParam = operator_id ? '$2' : '$1';
      const r = await pool.query(
        `SELECT operator_id,
                COUNT(*)::int as total_inspections,
                SUM(defect_count)::int as defects_found,
                AVG(confidence_score)::float as avg_confidence,
                SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END)::int as fails
         FROM inspections
         ${where}
           ${where ? 'AND' : 'WHERE'} inspected_at >= NOW() - (${intervalParam}::int || ' days')::interval
         GROUP BY operator_id
         ORDER BY defects_found DESC NULLS LAST`,
        params
      );
      stats = r.rows;
    } catch (_) { stats = []; }

    const systemPrompt = `You are a manufacturing performance coach. Rank operators by defect-finding skill, identify strengths/weaknesses, and recommend training. Always respond with valid JSON only.

Respond with:
- top_performers: array of { operator_id, score (0-100), strengths }
- needs_coaching: array of { operator_id, weakness, suggested_training }
- skill_clusters: array of { defect_type, top_operator_ids }
- shift_observations: array of strings`;

    const userMessage = `Operator (or 'all'): ${operator_id || 'all'}
Period (days): ${period_days || 30}

Stats:
${JSON.stringify(stats)}`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    await persistAIResult({
      feature: 'operator-scorecard',
      user_id: userId(req),
      entity_type: 'operator',
      entity_id: parseInt(operator_id, 10) || null,
      prompt_summary: `period=${period_days || 30}d operators=${stats.length}`,
      result,
    });
    res.json({ success: true, scorecard: result, operators_analyzed: stats.length });
  } catch (err) {
    console.error('operator-scorecard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/cross-line-correlation
// Defect correlations across production lines.
router.post('/cross-line-correlation', auth, async (req, res) => {
  try {
    const { line_ids, lookback_days } = req.body;

    let stats = [];
    try {
      const r = await pool.query(
        `SELECT production_line_id, DATE_TRUNC('day', inspected_at) as day,
                SUM(defect_count)::int as defects
         FROM inspections
         WHERE inspected_at >= NOW() - ($1::int || ' days')::interval
           ${line_ids && line_ids.length ? `AND production_line_id = ANY($2::int[])` : ''}
         GROUP BY production_line_id, day
         ORDER BY day, production_line_id`,
        line_ids && line_ids.length ? [lookback_days || 14, line_ids] : [lookback_days || 14]
      );
      stats = r.rows;
    } catch (_) { stats = []; }

    const systemPrompt = `You are a quality correlation analyst. Identify if defect spikes on one line correlate with another (shared parts/suppliers). Respond with valid JSON only.

Respond with:
- correlations: array of { line_a, line_b, correlation (-1 to 1), suspected_shared_cause }
- shared_root_causes: array of { cause, lines_affected, confidence }
- recommended_investigations: array of strings`;

    const userMessage = `Period (days): ${lookback_days || 14}
Lines: ${(line_ids || []).join(', ') || 'all'}

Daily defect counts:
${JSON.stringify(stats)}`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    await persistAIResult({
      feature: 'cross-line-correlation',
      user_id: userId(req),
      entity_type: 'production_line',
      entity_id: null,
      prompt_summary: `lines=${(line_ids || []).join(',')}`,
      result,
    });
    res.json({ success: true, analysis: result });
  } catch (err) {
    console.error('cross-line-correlation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/supplier-quality-risk
// Score suppliers by defect rate per material lot.
router.post('/supplier-quality-risk', auth, async (req, res) => {
  try {
    const { supplier_data, defects_summary } = req.body;

    const systemPrompt = `You are a supplier quality manager. Score each supplier on quality risk and recommend material alternatives or renegotiation. Respond with valid JSON only.

Respond with:
- supplier_scores: array of { supplier, score (0-100), risk_level, defect_rate, trend }
- recommended_actions: array of { supplier, action, urgency }
- material_alternatives: array of { current_supplier, alternative, rationale }`;

    const userMessage = `Suppliers:
${JSON.stringify(supplier_data || [])}

Defect summary:
${JSON.stringify(defects_summary || {})}`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    await persistAIResult({
      feature: 'supplier-quality-risk',
      user_id: userId(req),
      entity_type: 'supplier',
      entity_id: null,
      prompt_summary: 'supplier risk scoring',
      result,
    });
    res.json({ success: true, analysis: result });
  } catch (err) {
    console.error('supplier-quality-risk error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/containment-action
// Generate containment checklist for critical defect.
router.post('/containment-action', auth, async (req, res) => {
  try {
    const { defect_severity, defect_description, batch_id, production_line_id, customer_impact } = req.body;
    if (!defect_severity || !defect_description) {
      return res.status(400).json({ error: 'defect_severity and defect_description required' });
    }

    const systemPrompt = `You are a quality manager generating a containment action plan for a defect. Always respond with valid JSON only.

Respond with:
- containment_steps: array of { step, owner_role, eta_minutes, required }
- communication_plan: array of { audience, channel, message }
- regulatory_notifications: array of strings
- close_out_criteria: array of strings`;

    const userMessage = `Severity: ${defect_severity}
Description: ${defect_description}
Batch: ${batch_id || 'unknown'}
Line: ${production_line_id || 'unknown'}
Customer impact: ${customer_impact || 'unknown'}`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    await persistAIResult({
      feature: 'containment-action',
      user_id: userId(req),
      entity_type: 'batch',
      entity_id: parseInt(batch_id, 10) || null,
      prompt_summary: `severity=${defect_severity} batch=${batch_id || 'n/a'}`,
      result,
    });
    res.json({ success: true, containment_plan: result });
  } catch (err) {
    console.error('containment-action error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/maintenance-prediction
// Predict equipment failure dates based on defect & condition data.
router.post('/maintenance-prediction', auth, async (req, res) => {
  try {
    const { equipment_id, sensor_data, recent_defects } = req.body;

    const systemPrompt = `You are a predictive maintenance AI. Predict failure date and recommend maintenance schedule. Respond with valid JSON only.

Respond with:
- predicted_failure: { days_from_now, confidence, failure_mode }
- recommended_maintenance: array of { task, priority, estimated_hours, recommended_window }
- monitored_metrics: array of { metric, threshold, current_value }
- cost_avoidance_estimate_usd: number`;

    const userMessage = `Equipment: ${equipment_id || 'unspecified'}
Sensor data: ${JSON.stringify(sensor_data || {})}
Recent defects: ${JSON.stringify(recent_defects || [])}`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    await persistAIResult({
      feature: 'maintenance-prediction',
      user_id: userId(req),
      entity_type: 'equipment',
      entity_id: parseInt(equipment_id, 10) || null,
      prompt_summary: `equipment=${equipment_id || 'n/a'}`,
      result,
    });
    res.json({ success: true, prediction: result });
  } catch (err) {
    console.error('maintenance-prediction error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/training-grader
// Grade trainee inspection annotations vs. expert baseline.
router.post('/training-grader', auth, async (req, res) => {
  try {
    const { trainee_annotations, expert_baseline, defect_categories } = req.body;
    if (!trainee_annotations) return res.status(400).json({ error: 'trainee_annotations required' });

    const systemPrompt = `You are a training assessor for visual inspectors. Compare trainee annotations to an expert baseline, score them, and recommend modules to study. Respond with valid JSON only.

Respond with:
- overall_score: number (0-100)
- per_category_scores: array of { category, score, missed, false_positives }
- strengths: array of strings
- weaknesses: array of strings
- recommended_modules: array of { module_title, focus_area, est_minutes }`;

    const userMessage = `Trainee annotations:
${JSON.stringify(trainee_annotations)}

Expert baseline:
${JSON.stringify(expert_baseline || {})}

Defect categories: ${(defect_categories || []).join(', ')}`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    await persistAIResult({
      feature: 'training-grader',
      user_id: userId(req),
      entity_type: 'operator',
      entity_id: null,
      prompt_summary: 'inspector training grading',
      result,
    });
    res.json({ success: true, grading: result });
  } catch (err) {
    console.error('training-grader error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/yield-optimizer
// Recommend ranked adjustments to improve first-pass yield without capex.
router.post('/yield-optimizer', auth, async (req, res) => {
  try {
    const { current_yield, factors, target_yield } = req.body;

    const systemPrompt = `You are a continuous-improvement engineer. Recommend ranked, low-cost adjustments to improve first-pass yield. Respond with valid JSON only.

Respond with:
- ranked_recommendations: array of { rank, recommendation, factor, expected_yield_lift_pct, effort, owner }
- expected_total_lift_pct: number
- assumptions: array of strings
- risks: array of strings`;

    const userMessage = `Current yield: ${current_yield || 'unknown'}
Target yield: ${target_yield || 'best achievable'}
Factors:
${JSON.stringify(factors || {})}`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    await persistAIResult({
      feature: 'yield-optimizer',
      user_id: userId(req),
      entity_type: 'production_line',
      entity_id: null,
      prompt_summary: `target=${target_yield || 'best'}`,
      result,
    });
    res.json({ success: true, plan: result });
  } catch (err) {
    console.error('yield-optimizer error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/history — paginated ai_results history
router.get('/history', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const feature = req.query.feature ? String(req.query.feature) : null;

    const params = [];
    let where = '';
    if (feature) {
      params.push(feature);
      where = `WHERE feature = $${params.length}`;
    }
    const countRes = await pool.query(`SELECT COUNT(*) FROM ai_results ${where}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(limit);
    params.push(offset);
    const dataRes = await pool.query(
      `SELECT id, feature, user_id, entity_type, entity_id, prompt_summary, result, model, created_at
       FROM ai_results ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      data: dataRes.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('ai history error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

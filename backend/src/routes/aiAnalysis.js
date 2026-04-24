const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouter(systemPrompt, userMessage) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
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

  // Try to parse as JSON, otherwise return as text
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    return JSON.parse(content);
  } catch {
    return { analysis: content };
  }
}

// POST /api/ai/detect-defects
router.post('/detect-defects', async (req, res) => {
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
    res.json(result);
  } catch (err) {
    console.error('Detect defects error:', err);
    res.status(500).json({ error: err.message || 'AI analysis failed' });
  }
});

// POST /api/ai/classify-defect
router.post('/classify-defect', async (req, res) => {
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
    res.json(result);
  } catch (err) {
    console.error('Classify defect error:', err);
    res.status(500).json({ error: err.message || 'AI classification failed' });
  }
});

// POST /api/ai/quality-prediction
router.post('/quality-prediction', async (req, res) => {
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
    res.json(result);
  } catch (err) {
    console.error('Quality prediction error:', err);
    res.status(500).json({ error: err.message || 'AI prediction failed' });
  }
});

// POST /api/ai/root-cause
router.post('/root-cause', async (req, res) => {
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
    res.json(result);
  } catch (err) {
    console.error('Root cause analysis error:', err);
    res.status(500).json({ error: err.message || 'AI root cause analysis failed' });
  }
});

// POST /api/ai/recommendations
router.post('/recommendations', async (req, res) => {
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
    res.json(result);
  } catch (err) {
    console.error('Recommendations error:', err);
    res.status(500).json({ error: err.message || 'AI recommendations failed' });
  }
});

module.exports = router;

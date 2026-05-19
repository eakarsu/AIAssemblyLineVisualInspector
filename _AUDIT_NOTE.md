# Audit Apply Note — AIAssemblyLineVisualInspector

## Audit recommendations (from batch_00.md)

The audit reports 0 AI endpoints. **Scanner false-negative.** `backend/src/routes/aiAnalysis.js` already implements:
`/analyze-image`, `/classify-defect`, `/containment-action`, `/cross-line-correlation`, `/defect-trend-forecast`, `/detect-defects`, `/history`, `/maintenance-prediction`, `/operator-scorecard`, `/predict-quality`, `/quality-prediction`, `/recommendations`, `/root-cause`, `/supplier-quality-risk`, `/training-grader`, `/yield-optimizer`.

Audit "missing AI" already covered:
- Defect detection → `/detect-defects` / `/analyze-image`
- Quality prediction → `/quality-prediction` / `/predict-quality`
- Root cause analysis → `/root-cause`
- Anomaly streaming → not yet (needs streaming infra)

### Missing non-AI features
- MES integration
- Real-time SPC monitoring
- Operator skill leveling

## Implemented in this pass

None. Audit's 0-endpoint count is a false-negative; project already covers recommended AI surface.

## Backlog (not implemented)

| Item | Category | Reason |
|---|---|---|
| Real-time anomaly streaming | TOO-RISKY | Streaming pipeline + SPC engine |
| MES integration | NEEDS-CREDS | Parsec / Plex / Wonderware APIs |
| Real-time SPC monitoring | TOO-RISKY | Streaming infra |
| Operator skill leveling | NEEDS-PRODUCT-DECISION | Competency framework |
| CV defect detection (image upload) | TOO-RISKY | Image upload + vision pipeline (text version exists) |

## Apply pass 3 (frontend)

Verified: frontend already wired. `frontend/src/pages/AIAnalysis.jsx` (917
lines, registered at `/ai-analysis` in `App.js`) contains a tab UI that POSTs
to all 14+ AI endpoints via the shared axios instance in `frontend/src/api.js`,
which auto-attaches `Authorization: Bearer <token>` from localStorage.
Action: LEFT-AS-IS (no FE changes). Pass 2 added no endpoints, so nothing new
to surface.

## Apply pass 4 (mechanical backlog)

Skipped — every backlog item in this project is tagged TOO-RISKY (anomaly streaming, real-time SPC, CV defect detection), NEEDS-CREDS (MES integration), or NEEDS-PRODUCT-DECISION (operator skill leveling). The 16 existing AI endpoints in `backend/src/routes/aiAnalysis.js` already cover the audit's "missing AI" recommendations, so no mechanical AI-endpoint additions remain that fit the pass-4 cap (BE endpoint + simple FE page using existing helpers, no creds, no product decisions).

## Apply pass 5 (all backlog)

Skipped again. Re-evaluated the full backlog under pass-5 rules
(additive only, no heavy deps, in-memory stubs only for ML/embeddings).
Every remaining item still falls under one of:

- TOO-RISKY: real-time anomaly streaming, real-time SPC engine, CV
  defect detection (image upload + vision pipeline). All require a
  streaming infrastructure or image-handling pipeline that cannot be
  delivered as an additive in-memory stub.
- NEEDS-CREDS: MES integration (Parsec / Plex / Wonderware) requires
  per-tenant credentials and vendor SDK selection.
- NEEDS-PRODUCT-DECISION: operator skill leveling needs a competency
  framework (job-role taxonomy, level definitions, certification rules)
  before an AI endpoint adds value.

No code changed. Smoke test n/a.


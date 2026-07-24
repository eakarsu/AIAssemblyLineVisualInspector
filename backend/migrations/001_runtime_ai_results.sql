BEGIN;
CREATE TABLE IF NOT EXISTS runtime_ai_results (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  feature TEXT NOT NULL,
  input JSONB NOT NULL,
  content TEXT NOT NULL,
  model TEXT NOT NULL,
  provider_receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_runtime_ai_results_feature_created ON runtime_ai_results(feature, created_at DESC);
COMMIT;

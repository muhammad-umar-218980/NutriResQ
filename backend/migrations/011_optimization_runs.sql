-- 011_optimization_runs.sql
-- One record per optimization attempt. input_snapshot is the immutable normalized
-- input used by the algorithms; result_json is the complete returned result so
-- reopening a run never recomputes it with newer code.

CREATE TABLE IF NOT EXISTS optimization_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id      uuid NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  parent_run_id    uuid REFERENCES optimization_runs (id) ON DELETE SET NULL,
  run_by           uuid REFERENCES users (id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'running',
  algorithm_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_snapshot   jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics          jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings         jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_json      jsonb,
  error_code       text,
  error_message    text,
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT optimization_runs_status_check
    CHECK (status IN ('running', 'succeeded', 'partial', 'failed'))
);

CREATE INDEX IF NOT EXISTS optimization_runs_scenario_idx
  ON optimization_runs (scenario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS optimization_runs_status_idx
  ON optimization_runs (status, created_at DESC);

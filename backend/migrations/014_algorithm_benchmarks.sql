-- 014_algorithm_benchmarks.sql
-- Comparison measurements on equivalent inputs. A benchmark names the metric in
-- result_summary; runtime alone is never treated as proof of better quality.

CREATE TABLE IF NOT EXISTS algorithm_benchmarks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid REFERENCES optimization_runs (id) ON DELETE CASCADE,
  scenario_id       uuid NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  algorithm_name    text NOT NULL,
  baseline_name     text,
  input_fingerprint text NOT NULL,
  configuration     jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary    jsonb NOT NULL DEFAULT '{}'::jsonb,
  runtime_ms        double precision NOT NULL DEFAULT 0,
  memory_bytes      bigint,
  trial_number      integer NOT NULL DEFAULT 1,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT algorithm_benchmarks_runtime_check CHECK (runtime_ms >= 0),
  CONSTRAINT algorithm_benchmarks_memory_check
    CHECK (memory_bytes IS NULL OR memory_bytes >= 0),
  CONSTRAINT algorithm_benchmarks_trial_check CHECK (trial_number > 0)
);

CREATE INDEX IF NOT EXISTS algorithm_benchmarks_scenario_idx
  ON algorithm_benchmarks (scenario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS algorithm_benchmarks_run_idx
  ON algorithm_benchmarks (run_id);

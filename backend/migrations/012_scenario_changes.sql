-- 012_scenario_changes.sql
-- Audit trail for simulation edits. jsonb holds before/after descriptions; the
-- normalized source rows remain authoritative.

CREATE TABLE IF NOT EXISTS scenario_changes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id        uuid NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  source_run_id      uuid REFERENCES optimization_runs (id) ON DELETE SET NULL,
  change_type        text NOT NULL,
  target_entity_type text NOT NULL,
  target_entity_id   uuid,
  before_value       jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_value        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scenario_changes_change_type_check CHECK (length(btrim(change_type)) > 0),
  CONSTRAINT scenario_changes_target_type_check
    CHECK (length(btrim(target_entity_type)) > 0)
);

CREATE INDEX IF NOT EXISTS scenario_changes_scenario_idx
  ON scenario_changes (scenario_id, created_at DESC);

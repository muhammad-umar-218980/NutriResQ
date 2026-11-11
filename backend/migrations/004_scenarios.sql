-- 004_scenarios.sql
-- A scenario is the editable data configuration for an optimization experiment.
-- A run snapshots the exact inputs, so editing a scenario never rewrites history.
-- Decision (BACKEND_SCHEMA.md section 10): operational rows are scenario-owned;
-- locations are shared reusable records joined through scenario_locations.

CREATE TABLE IF NOT EXISTS scenarios (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  description        text,
  status             text NOT NULL DEFAULT 'draft',
  parent_scenario_id uuid REFERENCES scenarios (id) ON DELETE SET NULL,
  created_by         uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scenarios_status_check CHECK (status IN ('draft', 'ready', 'archived')),
  CONSTRAINT scenarios_name_check CHECK (length(btrim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS scenarios_status_idx ON scenarios (status);
CREATE INDEX IF NOT EXISTS scenarios_created_at_idx ON scenarios (created_at DESC);

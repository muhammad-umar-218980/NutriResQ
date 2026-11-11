-- 008_recipients.sql
-- Recipient organization and its modelled need. demand_units and priority_score
-- are documented integer scales; priority feeds the DP value formula
-- (value_score * recipient_priority).

CREATE TABLE IF NOT EXISTS recipients (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id    uuid NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  location_id    uuid NOT NULL REFERENCES locations (id) ON DELETE RESTRICT,
  user_id        uuid REFERENCES users (id) ON DELETE SET NULL,
  name           text NOT NULL,
  recipient_type text,
  demand_units   integer NOT NULL DEFAULT 0,
  priority_score integer NOT NULL DEFAULT 50,
  is_available   boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipients_name_check CHECK (length(btrim(name)) > 0),
  CONSTRAINT recipients_demand_check CHECK (demand_units >= 0),
  CONSTRAINT recipients_priority_check CHECK (priority_score BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS recipients_scenario_idx
  ON recipients (scenario_id, is_available);
CREATE INDEX IF NOT EXISTS recipients_user_idx ON recipients (user_id);
CREATE INDEX IF NOT EXISTS recipients_location_idx ON recipients (location_id);

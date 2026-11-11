-- 007_donors.sql
-- Food donation source. Optional user_id links a portal account to its donor
-- record; authentication stays in `users`, never here.

CREATE TABLE IF NOT EXISTS donors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations (id) ON DELETE RESTRICT,
  user_id     uuid REFERENCES users (id) ON DELETE SET NULL,
  name        text NOT NULL,
  donor_type  text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT donors_name_check CHECK (length(btrim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS donors_scenario_idx ON donors (scenario_id, is_active);
CREATE INDEX IF NOT EXISTS donors_user_idx ON donors (user_id);
CREATE INDEX IF NOT EXISTS donors_location_idx ON donors (location_id);

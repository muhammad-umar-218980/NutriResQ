-- 010_vehicles.sql
-- One capacity dimension (weight in kilograms, the same integer scale as the DP).
-- owner_user_id links a delivery-partner account to the fleet it can edit.

CREATE TABLE IF NOT EXISTS vehicles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id       uuid NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  owner_user_id     uuid REFERENCES users (id) ON DELETE SET NULL,
  name              text NOT NULL,
  capacity_units    integer NOT NULL,
  start_location_id uuid REFERENCES locations (id) ON DELETE SET NULL,
  is_available      boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicles_name_check CHECK (length(btrim(name)) > 0),
  CONSTRAINT vehicles_capacity_check CHECK (capacity_units > 0)
);

CREATE INDEX IF NOT EXISTS vehicles_scenario_idx ON vehicles (scenario_id, is_available);
CREATE INDEX IF NOT EXISTS vehicles_owner_idx ON vehicles (owner_user_id);
CREATE INDEX IF NOT EXISTS vehicles_start_location_idx ON vehicles (start_location_id);

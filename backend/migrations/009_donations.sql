-- 009_donations.sql
-- One row = one indivisible package. weight_units is an integer in kilograms
-- (1 unit = 1 kg); value_score is 0..100 and the DP objective multiplies it by
-- the recipient priority. Expiry is evaluated against the run start timestamp:
-- expires_at <= run_started_at means expired.

CREATE TABLE IF NOT EXISTS donations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id   uuid NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  donor_id      uuid NOT NULL REFERENCES donors (id) ON DELETE CASCADE,
  package_name  text NOT NULL,
  weight_units  integer NOT NULL,
  value_score   integer NOT NULL,
  recipient_id  uuid REFERENCES recipients (id) ON DELETE SET NULL,
  available_at  timestamptz,
  expires_at    timestamptz,
  is_eligible   boolean NOT NULL DEFAULT true,
  status        text NOT NULL DEFAULT 'available',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT donations_package_name_check CHECK (length(btrim(package_name)) > 0),
  CONSTRAINT donations_weight_check CHECK (weight_units > 0),
  CONSTRAINT donations_value_check CHECK (value_score BETWEEN 0 AND 100),
  CONSTRAINT donations_status_check
    CHECK (status IN ('available', 'expired', 'reserved', 'unavailable'))
);

CREATE INDEX IF NOT EXISTS donations_scenario_status_idx
  ON donations (scenario_id, status, expires_at);
CREATE INDEX IF NOT EXISTS donations_donor_idx ON donations (donor_id);
CREATE INDEX IF NOT EXISTS donations_recipient_idx ON donations (recipient_id);

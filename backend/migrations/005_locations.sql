-- 005_locations.sql
-- Shared geographic nodes. Projected coordinates are optional and, when used,
-- come from a documented projection (equirectangular metres around the scenario
-- centroid). Latitude/longitude are never labelled as kilometres.

CREATE TABLE IF NOT EXISTS locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  location_type text NOT NULL DEFAULT 'other',
  latitude      double precision NOT NULL,
  longitude     double precision NOT NULL,
  projected_x   double precision,
  projected_y   double precision,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT locations_type_check
    CHECK (location_type IN ('donor', 'recipient', 'hub', 'other')),
  CONSTRAINT locations_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT locations_longitude_check CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT locations_name_check CHECK (length(btrim(name)) > 0)
);

-- Scenario membership: which shared locations belong to a scenario.
CREATE TABLE IF NOT EXISTS scenario_locations (
  scenario_id uuid NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, location_id)
);

CREATE INDEX IF NOT EXISTS scenario_locations_location_idx
  ON scenario_locations (location_id);

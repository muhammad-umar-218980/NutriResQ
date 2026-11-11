-- 006_roads.sql
-- Road edge between two locations. Closed roads stay stored and are excluded
-- from the run graph. Roads are bidirectional by default; an explicit reverse
-- row may co-exist (the unique index is per directed pair).

CREATE TABLE IF NOT EXISTS roads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id      uuid NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  from_location_id uuid NOT NULL REFERENCES locations (id) ON DELETE RESTRICT,
  to_location_id   uuid NOT NULL REFERENCES locations (id) ON DELETE RESTRICT,
  cost             double precision NOT NULL,
  cost_unit        text NOT NULL DEFAULT 'km',
  is_available     boolean NOT NULL DEFAULT true,
  is_bidirectional boolean NOT NULL DEFAULT true,
  label            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roads_distinct_endpoints CHECK (from_location_id <> to_location_id),
  CONSTRAINT roads_cost_check CHECK (cost >= 0 AND cost < 'Infinity'::double precision),
  CONSTRAINT roads_cost_unit_check CHECK (length(btrim(cost_unit)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS roads_unique_directed_edge
  ON roads (scenario_id, from_location_id, to_location_id);
CREATE INDEX IF NOT EXISTS roads_scenario_available_idx
  ON roads (scenario_id, is_available);
CREATE INDEX IF NOT EXISTS roads_from_idx ON roads (from_location_id);
CREATE INDEX IF NOT EXISTS roads_to_idx ON roads (to_location_id);

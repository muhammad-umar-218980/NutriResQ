-- 015_roads_geometry.sql
-- Street-following polyline for a road, stored as [[lat, lon], ...] from the
-- from-location to the to-location. Baked once from the real Karachi road
-- network (see backend/scripts/generate-road-geometry.py), so the map can draw
-- routes along roads instead of straight chords between pins.
--
-- Nullable: a road created manually after seeding has no geometry, and the map
-- falls back to a straight line between its endpoints.

ALTER TABLE roads ADD COLUMN IF NOT EXISTS geometry jsonb;

ALTER TABLE roads DROP CONSTRAINT IF EXISTS roads_geometry_array_check;
ALTER TABLE roads ADD CONSTRAINT roads_geometry_array_check
  CHECK (geometry IS NULL OR jsonb_typeof(geometry) = 'array');

COMMENT ON COLUMN roads.geometry IS
  'Street polyline [[lat, lon], ...] from from_location_id to to_location_id.';

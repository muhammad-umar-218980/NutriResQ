-- 013_run_results.sql
-- Allocations, routes and ordered stops belong to a run and cascade with it.
-- Source ids are kept for querying; snapshot labels keep old runs readable after
-- a donation or vehicle is edited/deleted, and result_json remains the source of
-- truth for a stored result.

CREATE TABLE IF NOT EXISTS vehicle_allocations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id               uuid NOT NULL REFERENCES optimization_runs (id) ON DELETE CASCADE,
  vehicle_id           uuid REFERENCES vehicles (id) ON DELETE SET NULL,
  donation_id          uuid REFERENCES donations (id) ON DELETE SET NULL,
  vehicle_label        text,
  donation_label       text,
  assigned_weight_units integer NOT NULL,
  value_score          integer NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_allocations_weight_check CHECK (assigned_weight_units > 0),
  CONSTRAINT vehicle_allocations_value_check CHECK (value_score >= 0),
  CONSTRAINT vehicle_allocations_unique_package UNIQUE (run_id, donation_id)
);

CREATE INDEX IF NOT EXISTS vehicle_allocations_run_vehicle_idx
  ON vehicle_allocations (run_id, vehicle_id);

CREATE TABLE IF NOT EXISTS routes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           uuid NOT NULL REFERENCES optimization_runs (id) ON DELETE CASCADE,
  vehicle_id       uuid REFERENCES vehicles (id) ON DELETE SET NULL,
  vehicle_label    text,
  status           text NOT NULL,
  total_cost       double precision NOT NULL DEFAULT 0,
  cost_unit        text NOT NULL DEFAULT 'km',
  algorithm_name   text NOT NULL,
  algorithm_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  infeasible_reason text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT routes_status_check
    CHECK (status IN ('complete', 'partial', 'infeasible', 'not_required')),
  CONSTRAINT routes_cost_check CHECK (total_cost >= 0),
  CONSTRAINT routes_cost_unit_check CHECK (length(btrim(cost_unit)) > 0)
);

CREATE INDEX IF NOT EXISTS routes_run_vehicle_idx ON routes (run_id, vehicle_id);

CREATE TABLE IF NOT EXISTS route_stops (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id              uuid NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
  sequence_number       integer NOT NULL,
  location_id           uuid REFERENCES locations (id) ON DELETE SET NULL,
  location_label        text,
  stop_type             text NOT NULL,
  related_donation_id   uuid REFERENCES donations (id) ON DELETE SET NULL,
  related_recipient_id  uuid REFERENCES recipients (id) ON DELETE SET NULL,
  leg_cost_from_previous double precision,
  leg_path              jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT route_stops_sequence_check CHECK (sequence_number > 0),
  CONSTRAINT route_stops_type_check
    CHECK (stop_type IN ('start', 'pickup', 'delivery', 'other')),
  CONSTRAINT route_stops_leg_cost_check
    CHECK (leg_cost_from_previous IS NULL OR leg_cost_from_previous >= 0),
  CONSTRAINT route_stops_sequence_unique UNIQUE (route_id, sequence_number)
);

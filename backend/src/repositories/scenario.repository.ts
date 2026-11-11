import { query } from '../db/pool';
import { projectLocations } from '../algorithms/lib/graph';
import type {
  DonationRecord,
  DonorRecord,
  LocationRecord,
  RecipientRecord,
  RoadRecord,
  ScenarioRecord,
  ScenarioSnapshot,
  VehicleRecord,
} from '../types/domain';

interface ScenarioRow {
  id: string;
  name: string;
  description: string | null;
  status: ScenarioRecord['status'];
  parent_scenario_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ScenarioCountRow extends ScenarioRow {
  location_count: string;
  road_count: string;
  donation_count: string;
  vehicle_count: string;
  run_count: string;
}

interface LocationRow {
  id: string;
  name: string;
  location_type: LocationRecord['locationType'];
  latitude: number;
  longitude: number;
}

interface RoadRow {
  id: string;
  scenario_id: string;
  from_location_id: string;
  to_location_id: string;
  cost: number;
  cost_unit: string;
  is_available: boolean;
  is_bidirectional: boolean;
}

interface DonorRow {
  id: string;
  scenario_id: string;
  location_id: string;
  name: string;
  donor_type: string | null;
  is_active: boolean;
}

interface RecipientRow {
  id: string;
  scenario_id: string;
  location_id: string;
  name: string;
  recipient_type: string | null;
  demand_units: number;
  priority_score: number;
  is_available: boolean;
}

interface DonationRow {
  id: string;
  scenario_id: string;
  donor_id: string;
  package_name: string;
  weight_units: number;
  value_score: number;
  recipient_id: string | null;
  available_at: Date | null;
  expires_at: Date | null;
  is_eligible: boolean;
  status: DonationRecord['status'];
  donor_location_id: string | null;
  recipient_location_id: string | null;
  recipient_priority: number | null;
}

interface VehicleRow {
  id: string;
  scenario_id: string;
  name: string;
  capacity_units: number;
  start_location_id: string | null;
  is_available: boolean;
}

export interface ScenarioSummary extends ScenarioRecord {
  counts: {
    locations: number;
    roads: number;
    donations: number;
    vehicles: number;
    runs: number;
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toScenario(row: ScenarioRow): ScenarioRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    parentScenarioId: row.parent_scenario_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

const SCENARIO_COUNTS = `
  (SELECT count(*)::text FROM scenario_locations sl WHERE sl.scenario_id = s.id) AS location_count,
  (SELECT count(*)::text FROM roads r WHERE r.scenario_id = s.id) AS road_count,
  (SELECT count(*)::text FROM donations d WHERE d.scenario_id = s.id) AS donation_count,
  (SELECT count(*)::text FROM vehicles v WHERE v.scenario_id = s.id) AS vehicle_count,
  (SELECT count(*)::text FROM optimization_runs o WHERE o.scenario_id = s.id) AS run_count
`;

export async function listScenarios(): Promise<ScenarioSummary[]> {
  const result = await query<ScenarioCountRow>(
    `SELECT s.*, ${SCENARIO_COUNTS}
       FROM scenarios s
      ORDER BY s.created_at DESC, s.name ASC`,
  );

  return result.rows.map((row) => ({
    ...toScenario(row),
    counts: {
      locations: Number(row.location_count),
      roads: Number(row.road_count),
      donations: Number(row.donation_count),
      vehicles: Number(row.vehicle_count),
      runs: Number(row.run_count),
    },
  }));
}

export async function findScenarioById(id: string): Promise<ScenarioSummary | null> {
  const result = await query<ScenarioCountRow>(
    `SELECT s.*, ${SCENARIO_COUNTS}
       FROM scenarios s
      WHERE s.id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    ...toScenario(row),
    counts: {
      locations: Number(row.location_count),
      roads: Number(row.road_count),
      donations: Number(row.donation_count),
      vehicles: Number(row.vehicle_count),
      runs: Number(row.run_count),
    },
  };
}

/**
 * Loads the immutable input snapshot for a scenario.
 *
 * Closed roads are returned as stored (isAvailable = false) so the run graph
 * builder can exclude them while the UI can still show them.
 */
export async function loadScenarioSnapshot(
  scenarioId: string,
): Promise<ScenarioSnapshot | null> {
  const scenarioResult = await query<ScenarioRow>('SELECT * FROM scenarios WHERE id = $1', [
    scenarioId,
  ]);
  const scenarioRow = scenarioResult.rows[0];
  if (!scenarioRow) return null;

  const locationResult = await query<LocationRow>(
    `SELECT l.id, l.name, l.location_type, l.latitude, l.longitude
       FROM locations l
       JOIN scenario_locations sl ON sl.location_id = l.id
      WHERE sl.scenario_id = $1
      ORDER BY l.name ASC, l.id ASC`,
    [scenarioId],
  );

  const locations = locationResult.rows.map<LocationRecord>((row) => ({
    id: row.id,
    name: row.name,
    locationType: row.location_type,
    latitude: row.latitude,
    longitude: row.longitude,
    projectedX: 0,
    projectedY: 0,
  }));

  // Projection is a read-time mapping (equirectangular metres around centroid).
  const projected = projectLocations(locations);
  for (const location of locations) {
    const point = projected.get(location.id);
    if (point) {
      location.projectedX = point.x;
      location.projectedY = point.y;
    }
  }

  const roadResult = await query<RoadRow>(
    `SELECT * FROM roads WHERE scenario_id = $1 ORDER BY id ASC`,
    [scenarioId],
  );

  const donorResult = await query<DonorRow>(
    `SELECT * FROM donors WHERE scenario_id = $1 ORDER BY name ASC, id ASC`,
    [scenarioId],
  );

  const recipientResult = await query<RecipientRow>(
    `SELECT * FROM recipients WHERE scenario_id = $1 ORDER BY name ASC, id ASC`,
    [scenarioId],
  );

  const donationResult = await query<DonationRow>(
    `SELECT d.*,
            dn.location_id AS donor_location_id,
            r.location_id  AS recipient_location_id,
            r.priority_score AS recipient_priority
       FROM donations d
       JOIN donors dn ON dn.id = d.donor_id
       LEFT JOIN recipients r ON r.id = d.recipient_id
      WHERE d.scenario_id = $1
      ORDER BY d.package_name ASC, d.id ASC`,
    [scenarioId],
  );

  const vehicleResult = await query<VehicleRow>(
    `SELECT * FROM vehicles WHERE scenario_id = $1 ORDER BY name ASC, id ASC`,
    [scenarioId],
  );

  const roads = roadResult.rows.map<RoadRecord>((row) => ({
    id: row.id,
    scenarioId: row.scenario_id,
    fromLocationId: row.from_location_id,
    toLocationId: row.to_location_id,
    cost: row.cost,
    costUnit: row.cost_unit,
    isAvailable: row.is_available,
    isBidirectional: row.is_bidirectional,
  }));

  const donors = donorResult.rows.map<DonorRecord>((row) => ({
    id: row.id,
    scenarioId: row.scenario_id,
    locationId: row.location_id,
    name: row.name,
    donorType: row.donor_type,
    isActive: row.is_active,
  }));

  const recipients = recipientResult.rows.map<RecipientRecord>((row) => ({
    id: row.id,
    scenarioId: row.scenario_id,
    locationId: row.location_id,
    name: row.name,
    recipientType: row.recipient_type,
    demandUnits: row.demand_units,
    priorityScore: row.priority_score,
    isAvailable: row.is_available,
  }));

  const donations = donationResult.rows.map<DonationRecord>((row) => ({
    id: row.id,
    scenarioId: row.scenario_id,
    donorId: row.donor_id,
    packageName: row.package_name,
    weightUnits: row.weight_units,
    valueScore: row.value_score,
    recipientId: row.recipient_id,
    availableAt: row.available_at ? toIso(row.available_at) : null,
    expiresAt: row.expires_at ? toIso(row.expires_at) : null,
    isEligible: row.is_eligible,
    status: row.status,
    donorLocationId: row.donor_location_id,
    recipientLocationId: row.recipient_location_id,
    // The DP value formula uses priority 1 when no recipient is intended.
    recipientPriority: row.recipient_priority ?? 1,
  }));

  const vehicles = vehicleResult.rows.map<VehicleRecord>((row) => ({
    id: row.id,
    scenarioId: row.scenario_id,
    name: row.name,
    capacityUnits: row.capacity_units,
    startLocationId: row.start_location_id,
    isAvailable: row.is_available,
  }));

  return {
    scenarioId,
    scenarioName: scenarioRow.name,
    capturedAt: new Date().toISOString(),
    locations,
    roads,
    donors,
    recipients,
    donations,
    vehicles,
  };
}

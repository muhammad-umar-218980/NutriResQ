import { query } from '../db/pool';

/**
 * Role-scoped portal queries. Every read and write is filtered by the signed-in
 * user's ownership column, so a portal account can only ever touch its own
 * donor, recipient or vehicle rows. No authorization decision is made here;
 * routes and services enforce that with `requireRole`.
 */

export interface PortalScenario {
  id: string;
  name: string;
  status: string;
}

export interface PortalLocation {
  id: string;
  name: string;
  locationType: string;
}

export interface OwnedDonor {
  id: string;
  scenarioId: string;
  name: string;
  donorType: string | null;
  isActive: boolean;
  locationId: string;
  locationName: string;
}

export interface OwnedRecipient {
  id: string;
  scenarioId: string;
  name: string;
  recipientType: string | null;
  demandUnits: number;
  priorityScore: number;
  isAvailable: boolean;
  locationId: string;
  locationName: string;
}

export interface PortalDonation {
  id: string;
  donorId: string;
  donorName: string;
  packageName: string;
  weightUnits: number;
  valueScore: number;
  recipientId: string | null;
  recipientName: string | null;
  availableAt: string | null;
  expiresAt: string | null;
  isEligible: boolean;
  status: 'available' | 'expired' | 'reserved' | 'unavailable';
  updatedAt: string;
}

export interface PortalVehicle {
  id: string;
  scenarioId: string;
  name: string;
  capacityUnits: number;
  startLocationId: string | null;
  startLocationName: string | null;
  isAvailable: boolean;
  updatedAt: string;
}

export interface PortalAssignment {
  routeId: string;
  runId: string;
  vehicleId: string;
  vehicleName: string | null;
  routeStatus: string;
  totalCost: number;
  costUnit: string;
  infeasibleReason: string | null;
  runStatus: string;
  startedAt: string;
  completedAt: string | null;
  stopCount: number;
}

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toIsoRequired(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function listPortalScenarios(): Promise<PortalScenario[]> {
  const result = await query<{ id: string; name: string; status: string }>(
    `SELECT id, name, status FROM scenarios ORDER BY created_at DESC, name ASC`,
  );
  return result.rows;
}

export async function listScenarioLocations(scenarioId: string): Promise<PortalLocation[]> {
  const result = await query<{ id: string; name: string; location_type: string }>(
    `SELECT l.id, l.name, l.location_type
       FROM locations l
       JOIN scenario_locations sl ON sl.location_id = l.id
      WHERE sl.scenario_id = $1
      ORDER BY l.name ASC, l.id ASC`,
    [scenarioId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    locationType: row.location_type,
  }));
}

/** True when the scenario exists. Used before creating vehicle rows. */
export async function scenarioExists(scenarioId: string): Promise<boolean> {
  const result = await query<{ id: string }>('SELECT id FROM scenarios WHERE id = $1', [
    scenarioId,
  ]);
  return result.rowCount === 1;
}

/** True when the recipient belongs to the scenario (no cross-scenario links). */
export async function scenarioHasRecipient(
  scenarioId: string,
  recipientId: string,
): Promise<boolean> {
  const result = await query<{ id: string }>(
    'SELECT id FROM recipients WHERE id = $1 AND scenario_id = $2',
    [recipientId, scenarioId],
  );
  return result.rowCount === 1;
}

/** True when the location is part of the scenario. */
export async function scenarioHasLocation(
  scenarioId: string,
  locationId: string,
): Promise<boolean> {
  const result = await query<{ location_id: string }>(
    'SELECT location_id FROM scenario_locations WHERE scenario_id = $1 AND location_id = $2',
    [scenarioId, locationId],
  );
  return result.rowCount === 1;
}

export async function findDonorForUser(userId: string): Promise<OwnedDonor | null> {
  const result = await query<{
    id: string;
    scenario_id: string;
    name: string;
    donor_type: string | null;
    is_active: boolean;
    location_id: string;
    location_name: string;
  }>(
    `SELECT d.id, d.scenario_id, d.name, d.donor_type, d.is_active,
            d.location_id, l.name AS location_name
       FROM donors d
       JOIN locations l ON l.id = d.location_id
      WHERE d.user_id = $1
      ORDER BY d.created_at ASC
      LIMIT 1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    name: row.name,
    donorType: row.donor_type,
    isActive: row.is_active,
    locationId: row.location_id,
    locationName: row.location_name,
  };
}

export async function findRecipientForUser(userId: string): Promise<OwnedRecipient | null> {
  const result = await query<{
    id: string;
    scenario_id: string;
    name: string;
    recipient_type: string | null;
    demand_units: number;
    priority_score: number;
    is_available: boolean;
    location_id: string;
    location_name: string;
  }>(
    `SELECT r.id, r.scenario_id, r.name, r.recipient_type, r.demand_units,
            r.priority_score, r.is_available, r.location_id, l.name AS location_name
       FROM recipients r
       JOIN locations l ON l.id = r.location_id
      WHERE r.user_id = $1
      ORDER BY r.created_at ASC
      LIMIT 1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    name: row.name,
    recipientType: row.recipient_type,
    demandUnits: row.demand_units,
    priorityScore: row.priority_score,
    isAvailable: row.is_available,
    locationId: row.location_id,
    locationName: row.location_name,
  };
}

interface DonationDbRow {
  id: string;
  donor_id: string;
  donor_name: string;
  package_name: string;
  weight_units: number;
  value_score: number;
  recipient_id: string | null;
  recipient_name: string | null;
  available_at: Date | null;
  expires_at: Date | null;
  is_eligible: boolean;
  status: PortalDonation['status'];
  updated_at: Date;
}

function toDonation(row: DonationDbRow): PortalDonation {
  return {
    id: row.id,
    donorId: row.donor_id,
    donorName: row.donor_name,
    packageName: row.package_name,
    weightUnits: row.weight_units,
    valueScore: row.value_score,
    recipientId: row.recipient_id,
    recipientName: row.recipient_name,
    availableAt: toIso(row.available_at),
    expiresAt: toIso(row.expires_at),
    isEligible: row.is_eligible,
    status: row.status,
    updatedAt: toIsoRequired(row.updated_at),
  };
}

const DONATION_COLUMNS = `
  d.id, d.donor_id, dn.name AS donor_name, d.package_name, d.weight_units,
  d.value_score, d.recipient_id, r.name AS recipient_name, d.available_at,
  d.expires_at, d.is_eligible, d.status, d.updated_at
`;

export async function listDonationsForDonor(donorId: string): Promise<PortalDonation[]> {
  const result = await query<DonationDbRow>(
    `SELECT ${DONATION_COLUMNS}
       FROM donations d
       JOIN donors dn ON dn.id = d.donor_id
       LEFT JOIN recipients r ON r.id = d.recipient_id
      WHERE d.donor_id = $1
      ORDER BY d.updated_at DESC, d.id ASC`,
    [donorId],
  );
  return result.rows.map(toDonation);
}

export async function listDonationsForRecipient(
  recipientId: string,
): Promise<PortalDonation[]> {
  const result = await query<DonationDbRow>(
    `SELECT ${DONATION_COLUMNS}
       FROM donations d
       JOIN donors dn ON dn.id = d.donor_id
       LEFT JOIN recipients r ON r.id = d.recipient_id
      WHERE d.recipient_id = $1
      ORDER BY d.updated_at DESC, d.id ASC`,
    [recipientId],
  );
  return result.rows.map(toDonation);
}

export async function listRecipientOptionsForScenario(
  scenarioId: string,
): Promise<Array<{ id: string; name: string }>> {
  const result = await query<{ id: string; name: string }>(
    `SELECT id, name FROM recipients
      WHERE scenario_id = $1
      ORDER BY name ASC, id ASC`,
    [scenarioId],
  );
  return result.rows;
}

export interface DonationInput {
  packageName: string;
  weightUnits: number;
  valueScore: number;
  recipientId: string | null;
  availableAt: string | null;
  expiresAt: string | null;
  isEligible: boolean;
  status: PortalDonation['status'];
}

async function selectDonationById(donationId: string): Promise<PortalDonation | null> {
  const result = await query<DonationDbRow>(
    `SELECT ${DONATION_COLUMNS}
       FROM donations d
       JOIN donors dn ON dn.id = d.donor_id
       LEFT JOIN recipients r ON r.id = d.recipient_id
      WHERE d.id = $1`,
    [donationId],
  );
  return result.rows[0] ? toDonation(result.rows[0]) : null;
}

export async function createDonationForDonor(
  donor: OwnedDonor,
  input: DonationInput,
): Promise<PortalDonation> {
  const inserted = await query<{ id: string }>(
    `INSERT INTO donations
       (scenario_id, donor_id, package_name, weight_units, value_score,
        recipient_id, available_at, expires_at, is_eligible, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      donor.scenarioId,
      donor.id,
      input.packageName,
      input.weightUnits,
      input.valueScore,
      input.recipientId,
      input.availableAt,
      input.expiresAt,
      input.isEligible,
      input.status,
    ],
  );
  const donation = await selectDonationById(inserted.rows[0].id);
  if (!donation) throw new Error('The donation was saved but could not be reloaded.');
  return donation;
}

export async function updateDonationForDonor(
  donorId: string,
  donationId: string,
  input: DonationInput,
): Promise<PortalDonation | null> {
  const updated = await query<{ id: string }>(
    `UPDATE donations
        SET package_name = $3,
            weight_units = $4,
            value_score = $5,
            recipient_id = $6,
            available_at = $7,
            expires_at = $8,
            is_eligible = $9,
            status = $10,
            updated_at = now()
      WHERE id = $1 AND donor_id = $2
      RETURNING id`,
    [
      donationId,
      donorId,
      input.packageName,
      input.weightUnits,
      input.valueScore,
      input.recipientId,
      input.availableAt,
      input.expiresAt,
      input.isEligible,
      input.status,
    ],
  );
  if (updated.rowCount !== 1) return null;
  return selectDonationById(donationId);
}

export async function deleteDonationForDonor(
  donorId: string,
  donationId: string,
): Promise<boolean> {
  const result = await query<{ id: string }>(
    `DELETE FROM donations WHERE id = $1 AND donor_id = $2 RETURNING id`,
    [donationId, donorId],
  );
  return result.rowCount === 1;
}

export interface RecipientInput {
  recipientType: string | null;
  demandUnits: number;
  priorityScore: number;
  isAvailable: boolean;
}

export async function updateRecipientForUser(
  userId: string,
  input: RecipientInput,
): Promise<OwnedRecipient | null> {
  // RETURNING id first, then re-select: a data-modifying CTE is invisible to the
  // snapshot of the outer SELECT in the same statement.
  const updated = await query<{ id: string }>(
    `UPDATE recipients
        SET recipient_type = $2,
            demand_units = $3,
            priority_score = $4,
            is_available = $5,
            updated_at = now()
      WHERE user_id = $1
      RETURNING id`,
    [userId, input.recipientType, input.demandUnits, input.priorityScore, input.isAvailable],
  );
  if (updated.rowCount !== 1) return null;
  return selectRecipientById(updated.rows[0].id);
}

async function selectRecipientById(recipientId: string): Promise<OwnedRecipient | null> {
  const result = await query<{
    id: string;
    scenario_id: string;
    name: string;
    recipient_type: string | null;
    demand_units: number;
    priority_score: number;
    is_available: boolean;
    location_id: string;
    location_name: string;
  }>(
    `SELECT r.id, r.scenario_id, r.name, r.recipient_type, r.demand_units,
            r.priority_score, r.is_available, r.location_id, l.name AS location_name
       FROM recipients r
       JOIN locations l ON l.id = r.location_id
      WHERE r.id = $1`,
    [recipientId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    name: row.name,
    recipientType: row.recipient_type,
    demandUnits: row.demand_units,
    priorityScore: row.priority_score,
    isAvailable: row.is_available,
    locationId: row.location_id,
    locationName: row.location_name,
  };
}

interface VehicleDbRow {
  id: string;
  scenario_id: string;
  name: string;
  capacity_units: number;
  start_location_id: string | null;
  start_location_name: string | null;
  is_available: boolean;
  updated_at: Date;
}

function toVehicle(row: VehicleDbRow): PortalVehicle {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    name: row.name,
    capacityUnits: row.capacity_units,
    startLocationId: row.start_location_id,
    startLocationName: row.start_location_name,
    isAvailable: row.is_available,
    updatedAt: toIsoRequired(row.updated_at),
  };
}

const VEHICLE_COLUMNS = `
  v.id, v.scenario_id, v.name, v.capacity_units, v.start_location_id,
  l.name AS start_location_name, v.is_available, v.updated_at
`;

async function selectVehicleById(vehicleId: string): Promise<PortalVehicle | null> {
  const result = await query<VehicleDbRow>(
    `SELECT ${VEHICLE_COLUMNS}
       FROM vehicles v
       LEFT JOIN locations l ON l.id = v.start_location_id
      WHERE v.id = $1`,
    [vehicleId],
  );
  return result.rows[0] ? toVehicle(result.rows[0]) : null;
}

export async function listVehiclesForOwner(userId: string): Promise<PortalVehicle[]> {
  const result = await query<VehicleDbRow>(
    `SELECT ${VEHICLE_COLUMNS}
       FROM vehicles v
       LEFT JOIN locations l ON l.id = v.start_location_id
      WHERE v.owner_user_id = $1
      ORDER BY v.name ASC, v.id ASC`,
    [userId],
  );
  return result.rows.map(toVehicle);
}

export interface VehicleInput {
  scenarioId: string;
  name: string;
  capacityUnits: number;
  startLocationId: string | null;
  isAvailable: boolean;
}

export async function createVehicleForOwner(
  userId: string,
  input: VehicleInput,
): Promise<PortalVehicle> {
  const inserted = await query<{ id: string }>(
    `INSERT INTO vehicles
       (scenario_id, owner_user_id, name, capacity_units, start_location_id, is_available)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.scenarioId,
      userId,
      input.name,
      input.capacityUnits,
      input.startLocationId,
      input.isAvailable,
    ],
  );
  const vehicle = await selectVehicleById(inserted.rows[0].id);
  if (!vehicle) throw new Error('The vehicle was saved but could not be reloaded.');
  return vehicle;
}

export async function updateVehicleForOwner(
  userId: string,
  vehicleId: string,
  input: VehicleInput,
): Promise<PortalVehicle | null> {
  const updated = await query<{ id: string }>(
    `UPDATE vehicles
        SET scenario_id = $3,
            name = $4,
            capacity_units = $5,
            start_location_id = $6,
            is_available = $7,
            updated_at = now()
      WHERE id = $1 AND owner_user_id = $2
      RETURNING id`,
    [
      vehicleId,
      userId,
      input.scenarioId,
      input.name,
      input.capacityUnits,
      input.startLocationId,
      input.isAvailable,
    ],
  );
  if (updated.rowCount !== 1) return null;
  return selectVehicleById(vehicleId);
}

export async function deleteVehicleForOwner(
  userId: string,
  vehicleId: string,
): Promise<boolean> {
  const result = await query<{ id: string }>(
    `DELETE FROM vehicles WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
    [vehicleId, userId],
  );
  return result.rowCount === 1;
}

export async function listAssignmentsForOwner(userId: string): Promise<PortalAssignment[]> {
  const result = await query<{
    route_id: string;
    run_id: string;
    vehicle_id: string;
    vehicle_label: string | null;
    status: string;
    total_cost: number;
    cost_unit: string;
    infeasible_reason: string | null;
    run_status: string;
    started_at: Date;
    completed_at: Date | null;
    stop_count: string;
  }>(
    `SELECT rt.id AS route_id, rt.run_id, rt.vehicle_id, rt.vehicle_label,
            rt.status, rt.total_cost, rt.cost_unit, rt.infeasible_reason,
            o.status AS run_status, o.started_at, o.completed_at,
            (SELECT count(*)::text FROM route_stops rs WHERE rs.route_id = rt.id) AS stop_count
       FROM routes rt
       JOIN vehicles v ON v.id = rt.vehicle_id
       JOIN optimization_runs o ON o.id = rt.run_id
      WHERE v.owner_user_id = $1
      ORDER BY o.started_at DESC, rt.created_at DESC
      LIMIT 100`,
    [userId],
  );
  return result.rows.map((row) => ({
    routeId: row.route_id,
    runId: row.run_id,
    vehicleId: row.vehicle_id,
    vehicleName: row.vehicle_label,
    routeStatus: row.status,
    totalCost: row.total_cost,
    costUnit: row.cost_unit,
    infeasibleReason: row.infeasible_reason,
    runStatus: row.run_status,
    startedAt: toIsoRequired(row.started_at),
    completedAt: toIso(row.completed_at),
    stopCount: Number(row.stop_count),
  }));
}

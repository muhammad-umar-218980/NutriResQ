/**
 * SQL for simulator writes: cloning a scenario, patching one entity with a row
 * lock, and appending the scenario_changes audit trail.
 *
 * Every function that mutates takes the transaction's client so the caller can
 * commit the edit and its audit row atomically. Reads of the audit trail use the
 * shared pool because they never participate in a write transaction.
 */

import type { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { DonationRecord, ScenarioChangeRecord } from '../types/domain';

interface ScenarioChangeRow {
  id: string;
  scenario_id: string;
  source_run_id: string | null;
  change_type: ScenarioChangeRecord['changeType'];
  target_entity_type: ScenarioChangeRecord['targetEntityType'];
  target_entity_id: string | null;
  before_value: Record<string, unknown>;
  after_value: Record<string, unknown>;
  created_at: Date;
}

export interface ScenarioChangeInput {
  scenarioId: string;
  sourceRunId?: string | null;
  changeType: ScenarioChangeRecord['changeType'];
  targetEntityType: ScenarioChangeRecord['targetEntityType'];
  targetEntityId?: string | null;
  beforeValue: Record<string, unknown>;
  afterValue: Record<string, unknown>;
}

function toScenarioChange(row: ScenarioChangeRow): ScenarioChangeRecord {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    sourceRunId: row.source_run_id,
    changeType: row.change_type,
    targetEntityType: row.target_entity_type,
    targetEntityId: row.target_entity_id,
    beforeValue: row.before_value ?? {},
    afterValue: row.after_value ?? {},
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  };
}

export async function insertScenarioChange(
  client: PoolClient,
  input: ScenarioChangeInput,
): Promise<ScenarioChangeRecord> {
  const result = await client.query<ScenarioChangeRow>(
    `INSERT INTO scenario_changes
       (scenario_id, source_run_id, change_type, target_entity_type,
        target_entity_id, before_value, after_value)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     RETURNING *`,
    [
      input.scenarioId,
      input.sourceRunId ?? null,
      input.changeType,
      input.targetEntityType,
      input.targetEntityId ?? null,
      JSON.stringify(input.beforeValue),
      JSON.stringify(input.afterValue),
    ],
  );

  return toScenarioChange(result.rows[0]);
}

export async function listScenarioChanges(
  scenarioId: string,
  limit = 100,
): Promise<ScenarioChangeRecord[]> {
  const result = await query<ScenarioChangeRow>(
    `SELECT * FROM scenario_changes
      WHERE scenario_id = $1
      ORDER BY created_at DESC, id ASC
      LIMIT $2`,
    [scenarioId, limit],
  );

  return result.rows.map(toScenarioChange);
}

/* Clone ------------------------------------------------------------------- */

export async function insertScenarioClone(
  client: PoolClient,
  input: {
    sourceScenarioId: string;
    name: string;
    description: string | null;
    createdBy: string | null;
  },
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO scenarios (name, description, status, parent_scenario_id, created_by)
     VALUES ($1, $2, 'draft', $3, $4)
     RETURNING id`,
    [input.name, input.description, input.sourceScenarioId, input.createdBy],
  );

  return result.rows[0].id;
}

export async function lockScenario(
  client: PoolClient,
  scenarioId: string,
): Promise<{ id: string; name: string; description: string | null; parent_scenario_id: string | null } | null> {
  const result = await client.query<{
    id: string;
    name: string;
    description: string | null;
    parent_scenario_id: string | null;
  }>(
    `SELECT id, name, description, parent_scenario_id
       FROM scenarios
      WHERE id = $1
      FOR UPDATE`,
    [scenarioId],
  );

  return result.rows[0] ?? null;
}

export async function touchScenario(client: PoolClient, scenarioId: string): Promise<void> {
  await client.query('UPDATE scenarios SET updated_at = now() WHERE id = $1', [scenarioId]);
}

export async function copyScenarioLocations(
  client: PoolClient,
  sourceScenarioId: string,
  targetScenarioId: string,
): Promise<number> {
  const result = await client.query(
    `INSERT INTO scenario_locations (scenario_id, location_id)
     SELECT $1, location_id
       FROM scenario_locations
      WHERE scenario_id = $2
      ON CONFLICT (scenario_id, location_id) DO NOTHING`,
    [targetScenarioId, sourceScenarioId],
  );

  return result.rowCount ?? 0;
}

export async function copyRoads(
  client: PoolClient,
  sourceScenarioId: string,
  targetScenarioId: string,
): Promise<number> {
  const result = await client.query(
    `INSERT INTO roads
       (scenario_id, from_location_id, to_location_id, cost, cost_unit,
        is_available, is_bidirectional, label, geometry)
     SELECT $1, from_location_id, to_location_id, cost, cost_unit,
            is_available, is_bidirectional, label, geometry
       FROM roads
      WHERE scenario_id = $2`,
    [targetScenarioId, sourceScenarioId],
  );

  return result.rowCount ?? 0;
}

interface DonorCloneRow {
  id: string;
  location_id: string;
  name: string;
  donor_type: string | null;
  is_active: boolean;
}

/**
 * Donors are re-inserted one by one so donations can be remapped to the new
 * ids. `user_id` is intentionally dropped: a variant is a what-if copy, and the
 * portal account keeps owning the original rows only.
 */
export async function copyDonors(
  client: PoolClient,
  sourceScenarioId: string,
  targetScenarioId: string,
): Promise<Map<string, string>> {
  const donors = await client.query<DonorCloneRow>(
    `SELECT id, location_id, name, donor_type, is_active
       FROM donors
      WHERE scenario_id = $1
      ORDER BY id ASC`,
    [sourceScenarioId],
  );

  const idMap = new Map<string, string>();

  for (const donor of donors.rows) {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO donors (scenario_id, location_id, name, donor_type, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [targetScenarioId, donor.location_id, donor.name, donor.donor_type, donor.is_active],
    );

    idMap.set(donor.id, inserted.rows[0].id);
  }

  return idMap;
}

interface RecipientCloneRow {
  id: string;
  location_id: string;
  name: string;
  recipient_type: string | null;
  demand_units: number;
  priority_score: number;
  is_available: boolean;
}

export async function copyRecipients(
  client: PoolClient,
  sourceScenarioId: string,
  targetScenarioId: string,
): Promise<Map<string, string>> {
  const recipients = await client.query<RecipientCloneRow>(
    `SELECT id, location_id, name, recipient_type, demand_units, priority_score, is_available
       FROM recipients
      WHERE scenario_id = $1
      ORDER BY id ASC`,
    [sourceScenarioId],
  );

  const idMap = new Map<string, string>();

  for (const recipient of recipients.rows) {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO recipients
         (scenario_id, location_id, name, recipient_type, demand_units,
          priority_score, is_available)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        targetScenarioId,
        recipient.location_id,
        recipient.name,
        recipient.recipient_type,
        recipient.demand_units,
        recipient.priority_score,
        recipient.is_available,
      ],
    );

    idMap.set(recipient.id, inserted.rows[0].id);
  }

  return idMap;
}

interface DonationCloneRow {
  donor_id: string;
  package_name: string;
  weight_units: number;
  value_score: number;
  recipient_id: string | null;
  available_at: Date | null;
  expires_at: Date | null;
  is_eligible: boolean;
  status: DonationRecord['status'];
}

export async function copyDonations(
  client: PoolClient,
  sourceScenarioId: string,
  targetScenarioId: string,
  donorMap: Map<string, string>,
  recipientMap: Map<string, string>,
): Promise<number> {
  const donations = await client.query<DonationCloneRow>(
    `SELECT donor_id, package_name, weight_units, value_score, recipient_id,
            available_at, expires_at, is_eligible, status
       FROM donations
      WHERE scenario_id = $1
      ORDER BY id ASC`,
    [sourceScenarioId],
  );

  let copied = 0;

  for (const donation of donations.rows) {
    const donorId = donorMap.get(donation.donor_id);
    // A donation whose donor was not cloned cannot be attached to anything.
    if (!donorId) continue;

    const recipientId = donation.recipient_id
      ? recipientMap.get(donation.recipient_id) ?? null
      : null;

    await client.query(
      `INSERT INTO donations
         (scenario_id, donor_id, package_name, weight_units, value_score,
          recipient_id, available_at, expires_at, is_eligible, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        targetScenarioId,
        donorId,
        donation.package_name,
        donation.weight_units,
        donation.value_score,
        recipientId,
        donation.available_at,
        donation.expires_at,
        donation.is_eligible,
        donation.status,
      ],
    );

    copied++;
  }

  return copied;
}

interface VehicleCloneRow {
  name: string;
  capacity_units: number;
  start_location_id: string | null;
  is_available: boolean;
}

export async function copyVehicles(
  client: PoolClient,
  sourceScenarioId: string,
  targetScenarioId: string,
): Promise<number> {
  const vehicles = await client.query<VehicleCloneRow>(
    `SELECT name, capacity_units, start_location_id, is_available
       FROM vehicles
      WHERE scenario_id = $1
      ORDER BY id ASC`,
    [sourceScenarioId],
  );

  let copied = 0;

  for (const vehicle of vehicles.rows) {
    await client.query(
      `INSERT INTO vehicles
         (scenario_id, name, capacity_units, start_location_id, is_available)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        targetScenarioId,
        vehicle.name,
        vehicle.capacity_units,
        vehicle.start_location_id,
        vehicle.is_available,
      ],
    );

    copied++;
  }

  return copied;
}

/* Roads ------------------------------------------------------------------- */

export interface RoadRow {
  id: string;
  scenario_id: string;
  from_location_id: string;
  to_location_id: string;
  cost: number;
  cost_unit: string;
  is_available: boolean;
  is_bidirectional: boolean;
  geometry: unknown;
}

export async function findRoadForUpdate(
  client: PoolClient,
  scenarioId: string,
  roadId: string,
): Promise<RoadRow | null> {
  const result = await client.query<RoadRow>(
    `SELECT * FROM roads
      WHERE id = $1 AND scenario_id = $2
      FOR UPDATE`,
    [roadId, scenarioId],
  );

  return result.rows[0] ?? null;
}

export async function updateRoadAvailability(
  client: PoolClient,
  roadId: string,
  isAvailable: boolean,
): Promise<void> {
  await client.query(
    'UPDATE roads SET is_available = $2, updated_at = now() WHERE id = $1',
    [roadId, isAvailable],
  );
}

/* Vehicles ---------------------------------------------------------------- */

export interface VehicleRow {
  id: string;
  scenario_id: string;
  name: string;
  capacity_units: number;
  start_location_id: string | null;
  is_available: boolean;
}

export async function listVehiclesForUpdate(
  client: PoolClient,
  scenarioId: string,
): Promise<VehicleRow[]> {
  const result = await client.query<VehicleRow>(
    `SELECT id, scenario_id, name, capacity_units, start_location_id, is_available
       FROM vehicles
      WHERE scenario_id = $1
      ORDER BY name ASC, id ASC
      FOR UPDATE`,
    [scenarioId],
  );

  return result.rows;
}

export async function updateVehicleValues(
  client: PoolClient,
  vehicleId: string,
  patch: { isAvailable?: boolean; capacityUnits?: number },
): Promise<void> {
  await client.query(
    `UPDATE vehicles
        SET is_available = COALESCE($2, is_available),
            capacity_units = COALESCE($3, capacity_units),
            updated_at = now()
      WHERE id = $1`,
    [vehicleId, patch.isAvailable ?? null, patch.capacityUnits ?? null],
  );
}

/* Donations --------------------------------------------------------------- */

export interface DonationRow {
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
}

export async function findDonationForUpdate(
  client: PoolClient,
  scenarioId: string,
  donationId: string,
): Promise<DonationRow | null> {
  const result = await client.query<DonationRow>(
    `SELECT * FROM donations
      WHERE id = $1 AND scenario_id = $2
      FOR UPDATE`,
    [donationId, scenarioId],
  );

  return result.rows[0] ?? null;
}

export async function listDonationsForUpdate(
  client: PoolClient,
  scenarioId: string,
): Promise<DonationRow[]> {
  const result = await client.query<DonationRow>(
    `SELECT * FROM donations
      WHERE scenario_id = $1
      ORDER BY package_name ASC, id ASC
      FOR UPDATE`,
    [scenarioId],
  );

  return result.rows;
}

export async function updateDonationValues(
  client: PoolClient,
  donationId: string,
  patch: { weightUnits?: number; valueScore?: number; status?: DonationRecord['status'] },
): Promise<void> {
  await client.query(
    `UPDATE donations
        SET weight_units = COALESCE($2, weight_units),
            value_score = COALESCE($3, value_score),
            status = COALESCE($4, status),
            updated_at = now()
      WHERE id = $1`,
    [donationId, patch.weightUnits ?? null, patch.valueScore ?? null, patch.status ?? null],
  );
}

export async function updateDonationWeight(
  client: PoolClient,
  donationId: string,
  weightUnits: number,
): Promise<void> {
  await client.query(
    'UPDATE donations SET weight_units = $2, updated_at = now() WHERE id = $1',
    [donationId, weightUnits],
  );
}

/* Recipients -------------------------------------------------------------- */

export interface RecipientRow {
  id: string;
  scenario_id: string;
  location_id: string;
  name: string;
  recipient_type: string | null;
  demand_units: number;
  priority_score: number;
  is_available: boolean;
}

export async function findRecipientForUpdate(
  client: PoolClient,
  scenarioId: string,
  recipientId: string,
): Promise<RecipientRow | null> {
  const result = await client.query<RecipientRow>(
    `SELECT * FROM recipients
      WHERE id = $1 AND scenario_id = $2
      FOR UPDATE`,
    [recipientId, scenarioId],
  );

  return result.rows[0] ?? null;
}

export async function listRecipients(
  client: PoolClient,
  scenarioId: string,
): Promise<RecipientRow[]> {
  const result = await client.query<RecipientRow>(
    `SELECT * FROM recipients
      WHERE scenario_id = $1
      ORDER BY name ASC, id ASC`,
    [scenarioId],
  );

  return result.rows;
}

export async function updateRecipientValues(
  client: PoolClient,
  recipientId: string,
  patch: { demandUnits?: number; priorityScore?: number; isAvailable?: boolean },
): Promise<void> {
  await client.query(
    `UPDATE recipients
        SET demand_units = COALESCE($2, demand_units),
            priority_score = COALESCE($3, priority_score),
            is_available = COALESCE($4, is_available),
            updated_at = now()
      WHERE id = $1`,
    [recipientId, patch.demandUnits ?? null, patch.priorityScore ?? null, patch.isAvailable ?? null],
  );
}

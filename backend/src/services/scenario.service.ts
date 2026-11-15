/**
 * Scenario simulator service.
 *
 * Rules that hold for every write below:
 *  - the target row must belong to the scenario in the URL, otherwise 404
 *  - the edit and its `scenario_changes` row commit in one transaction
 *  - the parent scenario and its stored runs are never modified
 *  - a no-op patch is reported as `changed: false` and writes no audit row
 *
 * The exact-DP state guard is the one place where the simulator refuses an
 * edit: enabling capacity that pushes prod(capacity_j + 1) above the configured
 * limit would make every later run fail with `state_limit_exceeded`, so the
 * admin has to opt in explicitly.
 */

import type { PoolClient } from 'pg';
import { withTransaction } from '../db/pool';
import { NotFoundError, ValidationError } from '../errors/app-error';
import {
  defaultVariantName,
  metricDeltas,
  projectedStateCount,
  selectTopUrgencyRecipients,
} from '../lib/scenario-math';
import { findScenarioById, type ScenarioSummary } from '../repositories/scenario.repository';
import { findRunById } from '../repositories/run.repository';
import * as writes from '../repositories/scenario-write.repository';
import { DEFAULT_MAX_STATES } from './optimization.service';
import type {
  DonationRecord,
  RecipientRecord,
  RoadRecord,
  RunComparison,
  ScenarioChangeRecord,
  StateSpaceInfo,
  VehicleRecord,
} from '../types/domain';

export interface CloneScenarioRequest {
  sourceScenarioId: string;
  name?: string;
  description?: string | null;
  createdBy: string | null;
}

interface CloneOutcome {
  scenarioId: string;
  donorMap: Map<string, string>;
  recipientMap: Map<string, string>;
  counts: {
    locations: number;
    roads: number;
    donations: number;
    vehicles: number;
  };
}

function missingScenario(): NotFoundError {
  return new NotFoundError('No scenario matches that id.');
}

function toRoad(row: writes.RoadRow): RoadRecord {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    fromLocationId: row.from_location_id,
    toLocationId: row.to_location_id,
    cost: row.cost,
    costUnit: row.cost_unit,
    isAvailable: row.is_available,
    isBidirectional: row.is_bidirectional,
  };
}

function toVehicle(row: writes.VehicleRow): VehicleRecord {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    name: row.name,
    capacityUnits: row.capacity_units,
    startLocationId: row.start_location_id,
    isAvailable: row.is_available,
  };
}

function toRecipient(row: writes.RecipientRow): RecipientRecord {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    locationId: row.location_id,
    name: row.name,
    recipientType: row.recipient_type,
    demandUnits: row.demand_units,
    priorityScore: row.priority_score,
    isAvailable: row.is_available,
  };
}

function toStateSpace(capacities: readonly number[]): StateSpaceInfo {
  const projected = projectedStateCount(capacities);
  return {
    vehicleCount: capacities.length,
    projectedStateCount: projected,
    maxStates: DEFAULT_MAX_STATES,
    exceedsLimit: projected > DEFAULT_MAX_STATES,
  };
}

/* Clone ------------------------------------------------------------------- */

async function cloneWithin(client: PoolClient, request: CloneScenarioRequest): Promise<CloneOutcome> {
  const source = await writes.lockScenario(client, request.sourceScenarioId);
  if (!source) throw missingScenario();

  // `undefined` keeps the source description, an explicit null clears it.
  const description = request.description === undefined ? source.description : request.description;
  const name = request.name?.trim() || defaultVariantName(source.name);

  const scenarioId = await writes.insertScenarioClone(client, {
    sourceScenarioId: source.id,
    name,
    description,
    createdBy: request.createdBy,
  });

  const counts = {
    locations: await writes.copyScenarioLocations(client, source.id, scenarioId),
    roads: await writes.copyRoads(client, source.id, scenarioId),
    donations: 0,
    vehicles: 0,
  };

  const donorMap = await writes.copyDonors(client, source.id, scenarioId);
  const recipientMap = await writes.copyRecipients(client, source.id, scenarioId);
  counts.donations = await writes.copyDonations(
    client,
    source.id,
    scenarioId,
    donorMap,
    recipientMap,
  );
  counts.vehicles = await writes.copyVehicles(client, source.id, scenarioId);

  await writes.insertScenarioChange(client, {
    scenarioId,
    changeType: 'clone',
    targetEntityType: 'scenario',
    targetEntityId: source.id,
    beforeValue: { sourceScenarioId: source.id, sourceName: source.name },
    afterValue: { name, description, counts },
  });

  return { scenarioId, donorMap, recipientMap, counts };
}

export async function cloneScenario(request: CloneScenarioRequest): Promise<ScenarioSummary> {
  const { scenarioId } = await withTransaction((client) => cloneWithin(client, request));

  const scenario = await findScenarioById(scenarioId);
  if (!scenario) throw new Error('The cloned scenario could not be reloaded.');
  return scenario;
}

/* Roads ------------------------------------------------------------------- */

export interface RoadChange {
  road: RoadRecord;
  changed: boolean;
  change: ScenarioChangeRecord | null;
}

export async function updateRoadAvailability(
  scenarioId: string,
  roadId: string,
  isAvailable: boolean,
): Promise<RoadChange> {
  return withTransaction(async (client) => {
    const road = await writes.findRoadForUpdate(client, scenarioId, roadId);
    if (!road) throw new NotFoundError('No road in this scenario matches that id.');

    if (road.is_available === isAvailable) {
      return { road: toRoad(road), changed: false, change: null };
    }

    await writes.updateRoadAvailability(client, road.id, isAvailable);
    const change = await writes.insertScenarioChange(client, {
      scenarioId,
      changeType: 'road_availability',
      targetEntityType: 'road',
      targetEntityId: road.id,
      beforeValue: {
        isAvailable: road.is_available,
        fromLocationId: road.from_location_id,
        toLocationId: road.to_location_id,
        cost: road.cost,
      },
      afterValue: {
        isAvailable,
        fromLocationId: road.from_location_id,
        toLocationId: road.to_location_id,
        cost: road.cost,
      },
    });
    await writes.touchScenario(client, scenarioId);

    return { road: toRoad({ ...road, is_available: isAvailable }), changed: true, change };
  });
}

/* Vehicles ---------------------------------------------------------------- */

export interface VehicleChange {
  vehicle: VehicleRecord;
  changed: boolean;
  change: ScenarioChangeRecord | null;
  stateSpace: StateSpaceInfo;
}

export async function updateVehicle(
  scenarioId: string,
  vehicleId: string,
  patch: { isAvailable?: boolean; capacityUnits?: number },
  options: { allowLargeStateSpace?: boolean } = {},
): Promise<VehicleChange> {
  return withTransaction(async (client) => {
    const vehicles = await writes.listVehiclesForUpdate(client, scenarioId);
    const vehicle = vehicles.find((entry) => entry.id === vehicleId);
    if (!vehicle) throw new NotFoundError('No vehicle in this scenario matches that id.');

    const nextAvailable = patch.isAvailable ?? vehicle.is_available;
    const nextCapacity = patch.capacityUnits ?? vehicle.capacity_units;

    const beforeStateSpace = toStateSpace(
      vehicles.filter((entry) => entry.is_available).map((entry) => entry.capacity_units),
    );

    const afterCapacities: number[] = [];
    for (const entry of vehicles) {
      const isTarget = entry.id === vehicleId;
      const available = isTarget ? nextAvailable : entry.is_available;
      if (!available) continue;
      afterCapacities.push(isTarget ? nextCapacity : entry.capacity_units);
    }
    const afterStateSpace = toStateSpace(afterCapacities);

    if (
      afterStateSpace.exceedsLimit &&
      afterStateSpace.projectedStateCount > beforeStateSpace.projectedStateCount &&
      !options.allowLargeStateSpace
    ) {
      throw new ValidationError(
        `This edit would raise the exact DP state space to ${afterStateSpace.projectedStateCount.toLocaleString('en-US')} ` +
          `(${afterStateSpace.vehicleCount} available vehicles), above the ${afterStateSpace.maxStates.toLocaleString('en-US')} state limit. ` +
          'Disable another vehicle, or confirm the larger state space explicitly.',
        { stateSpace: afterStateSpace },
      );
    }

    const unchanged =
      vehicle.is_available === nextAvailable && vehicle.capacity_units === nextCapacity;
    if (unchanged) {
      return { vehicle: toVehicle(vehicle), changed: false, change: null, stateSpace: afterStateSpace };
    }

    await writes.updateVehicleValues(client, vehicle.id, {
      isAvailable: nextAvailable,
      capacityUnits: nextCapacity,
    });
    const change = await writes.insertScenarioChange(client, {
      scenarioId,
      changeType: 'vehicle_update',
      targetEntityType: 'vehicle',
      targetEntityId: vehicle.id,
      beforeValue: {
        isAvailable: vehicle.is_available,
        capacityUnits: vehicle.capacity_units,
        name: vehicle.name,
      },
      afterValue: {
        isAvailable: nextAvailable,
        capacityUnits: nextCapacity,
        name: vehicle.name,
        projectedStateCount: afterStateSpace.projectedStateCount,
      },
    });
    await writes.touchScenario(client, scenarioId);

    return {
      vehicle: toVehicle({
        ...vehicle,
        is_available: nextAvailable,
        capacity_units: nextCapacity,
      }),
      changed: true,
      change,
      stateSpace: afterStateSpace,
    };
  });
}

/* Donations --------------------------------------------------------------- */

export interface PatchedDonation {
  id: string;
  packageName: string;
  weightUnits: number;
  valueScore: number;
  status: DonationRecord['status'];
}

function toPatchedDonation(row: writes.DonationRow): PatchedDonation {
  return {
    id: row.id,
    packageName: row.package_name,
    weightUnits: row.weight_units,
    valueScore: row.value_score,
    status: row.status,
  };
}

export interface DonationChange {
  donation: PatchedDonation;
  changed: boolean;
  change: ScenarioChangeRecord | null;
}

export async function updateDonation(
  scenarioId: string,
  donationId: string,
  patch: { weightUnits?: number; valueScore?: number; status?: DonationRecord['status'] },
): Promise<DonationChange> {
  return withTransaction(async (client) => {
    const donation = await writes.findDonationForUpdate(client, scenarioId, donationId);
    if (!donation) throw new NotFoundError('No donation in this scenario matches that id.');

    const nextWeight = patch.weightUnits ?? donation.weight_units;
    const nextValue = patch.valueScore ?? donation.value_score;
    const nextStatus = patch.status ?? donation.status;

    const unchanged =
      donation.weight_units === nextWeight &&
      donation.value_score === nextValue &&
      donation.status === nextStatus;
    if (unchanged) {
      return { donation: toPatchedDonation(donation), changed: false, change: null };
    }

    await writes.updateDonationValues(client, donation.id, {
      weightUnits: nextWeight,
      valueScore: nextValue,
      status: nextStatus,
    });
    const change = await writes.insertScenarioChange(client, {
      scenarioId,
      changeType: 'donation_update',
      targetEntityType: 'donation',
      targetEntityId: donation.id,
      beforeValue: {
        weightUnits: donation.weight_units,
        valueScore: donation.value_score,
        status: donation.status,
        packageName: donation.package_name,
      },
      afterValue: {
        weightUnits: nextWeight,
        valueScore: nextValue,
        status: nextStatus,
        packageName: donation.package_name,
      },
    });
    await writes.touchScenario(client, scenarioId);

    return {
      donation: toPatchedDonation({
        ...donation,
        weight_units: nextWeight,
        value_score: nextValue,
        status: nextStatus,
      }),
      changed: true,
      change,
    };
  });
}

export interface SupplyReductionResult {
  change: ScenarioChangeRecord;
  summary: {
    percent: number;
    donationCount: number;
    affectedCount: number;
    totalWeightBefore: number;
    totalWeightAfter: number;
  };
}

/**
 * Bulk "supply shock": every package weight is reduced by `percent`, never
 * below 1 kg (the DP needs positive integer weights). One audit row records the
 * shock because it is one edit.
 */
export async function reduceSupply(scenarioId: string, percent: number): Promise<SupplyReductionResult> {
  return withTransaction(async (client) => {
    const donations = await writes.listDonationsForUpdate(client, scenarioId);
    if (donations.length === 0) {
      throw new ValidationError('This scenario has no donations to reduce.');
    }

    let affected = 0;
    let totalWeightBefore = 0;
    let totalWeightAfter = 0;

    for (const donation of donations) {
      totalWeightBefore += donation.weight_units;
      const nextWeight = Math.max(1, Math.round(donation.weight_units * (1 - percent / 100)));
      totalWeightAfter += nextWeight;

      if (nextWeight !== donation.weight_units) {
        await writes.updateDonationWeight(client, donation.id, nextWeight);
        affected++;
      }
    }

    const change = await writes.insertScenarioChange(client, {
      scenarioId,
      changeType: 'supply_reduced',
      targetEntityType: 'scenario',
      targetEntityId: scenarioId,
      beforeValue: {
        totalWeight: totalWeightBefore,
        donationCount: donations.length,
      },
      afterValue: {
        totalWeight: totalWeightAfter,
        percent,
        affectedCount: affected,
      },
    });
    await writes.touchScenario(client, scenarioId);

    return {
      change,
      summary: {
        percent,
        donationCount: donations.length,
        affectedCount: affected,
        totalWeightBefore,
        totalWeightAfter,
      },
    };
  });
}

/* Recipients -------------------------------------------------------------- */

export interface RecipientChange {
  recipient: RecipientRecord;
  changed: boolean;
  change: ScenarioChangeRecord | null;
}

export async function updateRecipient(
  scenarioId: string,
  recipientId: string,
  patch: { demandUnits?: number; priorityScore?: number; isAvailable?: boolean },
): Promise<RecipientChange> {
  return withTransaction(async (client) => {
    const recipient = await writes.findRecipientForUpdate(client, scenarioId, recipientId);
    if (!recipient) throw new NotFoundError('No recipient in this scenario matches that id.');

    const nextDemand = patch.demandUnits ?? recipient.demand_units;
    const nextPriority = patch.priorityScore ?? recipient.priority_score;
    const nextAvailable = patch.isAvailable ?? recipient.is_available;

    const unchanged =
      recipient.demand_units === nextDemand &&
      recipient.priority_score === nextPriority &&
      recipient.is_available === nextAvailable;
    if (unchanged) {
      return { recipient: toRecipient(recipient), changed: false, change: null };
    }

    await writes.updateRecipientValues(client, recipient.id, {
      demandUnits: nextDemand,
      priorityScore: nextPriority,
      isAvailable: nextAvailable,
    });
    const change = await writes.insertScenarioChange(client, {
      scenarioId,
      changeType: 'recipient_update',
      targetEntityType: 'recipient',
      targetEntityId: recipient.id,
      beforeValue: {
        demandUnits: recipient.demand_units,
        priorityScore: recipient.priority_score,
        isAvailable: recipient.is_available,
        name: recipient.name,
      },
      afterValue: {
        demandUnits: nextDemand,
        priorityScore: nextPriority,
        isAvailable: nextAvailable,
        name: recipient.name,
      },
    });
    await writes.touchScenario(client, scenarioId);

    return {
      recipient: toRecipient({
        ...recipient,
        demand_units: nextDemand,
        priority_score: nextPriority,
        is_available: nextAvailable,
      }),
      changed: true,
      change,
    };
  });
}

/* Sensitivity ------------------------------------------------------------- */

export interface SensitivityResult {
  scenario: ScenarioSummary;
  disabledRecipients: RecipientRecord[];
  changes: ScenarioChangeRecord[];
  note: string;
}

/**
 * Sensitivity experiment: clone the scenario and make the N most urgent
 * recipients unavailable. The original scenario and its runs are untouched; the
 * caller runs the variant and uses the compare endpoint for the delta.
 */
export async function createSensitivityVariant(input: {
  scenarioId: string;
  removeTopUrgencyCount: number;
  createdBy: string | null;
  name?: string;
}): Promise<SensitivityResult> {
  const outcome = await withTransaction(async (client) => {
    const source = await writes.lockScenario(client, input.scenarioId);
    if (!source) throw missingScenario();

    const recipients = await writes.listRecipients(client, input.scenarioId);
    if (recipients.length === 0) {
      throw new ValidationError('This scenario has no recipients to remove.');
    }

    const ranked = selectTopUrgencyRecipients(
      recipients.map((row) => ({
        row,
        name: row.name,
        priorityScore: row.priority_score,
        demandUnits: row.demand_units,
      })),
      input.removeTopUrgencyCount,
    );

    const clone = await cloneWithin(client, {
      sourceScenarioId: input.scenarioId,
      name: input.name?.trim() || `${source.name} — top ${ranked.length} urgency removed`,
      createdBy: input.createdBy,
    });

    const disabled: RecipientRecord[] = [];
    const changes: ScenarioChangeRecord[] = [];

    for (const entry of ranked) {
      const recipient = entry.row;
      const clonedId = clone.recipientMap.get(recipient.id);
      if (!clonedId) continue;

      await writes.updateRecipientValues(client, clonedId, { isAvailable: false });

      const change = await writes.insertScenarioChange(client, {
        scenarioId: clone.scenarioId,
        changeType: 'urgency_removed',
        targetEntityType: 'recipient',
        targetEntityId: clonedId,
        beforeValue: {
          isAvailable: recipient.is_available,
          priorityScore: recipient.priority_score,
          demandUnits: recipient.demand_units,
          name: recipient.name,
        },
        afterValue: {
          isAvailable: false,
          priorityScore: recipient.priority_score,
          demandUnits: recipient.demand_units,
          name: recipient.name,
        },
      });

      changes.push(change);
      disabled.push({
        id: clonedId,
        scenarioId: clone.scenarioId,
        locationId: recipient.location_id,
        name: recipient.name,
        recipientType: recipient.recipient_type,
        demandUnits: recipient.demand_units,
        priorityScore: recipient.priority_score,
        isAvailable: false,
      });
    }

    return { scenarioId: clone.scenarioId, disabled, changes };
  });

  const scenario = await findScenarioById(outcome.scenarioId);
  if (!scenario) throw new Error('The sensitivity variant could not be reloaded.');

  return {
    scenario,
    disabledRecipients: outcome.disabled,
    changes: outcome.changes,
    note:
      'Donations that name an unavailable recipient are excluded from allocation, so the variant measures the cost of serving without those recipients.',
  };
}

/* Audit trail ------------------------------------------------------------- */

export async function getScenarioChanges(
  scenarioId: string,
  limit = 100,
): Promise<ScenarioChangeRecord[]> {
  const scenario = await findScenarioById(scenarioId);
  if (!scenario) throw missingScenario();
  return writes.listScenarioChanges(scenarioId, limit);
}

/* Comparison -------------------------------------------------------------- */

function allocatedPackageCount(
  result: { allocations: Array<{ donationIds: string[] }> } | null,
): number {
  if (!result) return 0;
  return result.allocations.reduce((sum, allocation) => sum + allocation.donationIds.length, 0);
}

export async function compareRuns(input: {
  scenarioId: string;
  baseRunId: string;
  variantRunId: string;
}): Promise<RunComparison> {
  const scenario = await findScenarioById(input.scenarioId);
  if (!scenario) throw missingScenario();

  const [base, variant] = await Promise.all([
    findRunById(input.baseRunId),
    findRunById(input.variantRunId),
  ]);

  if (!base) throw new NotFoundError('No base run matches that id.');
  if (!variant) throw new NotFoundError('No variant run matches that id.');

  // The simulator compares a scenario with its direct parent only; anything
  // else would mix unrelated datasets and make the delta meaningless.
  const family = new Set<string>([scenario.id]);
  if (scenario.parentScenarioId) family.add(scenario.parentScenarioId);

  const foreign = [base, variant].find((run) => !family.has(run.scenarioId));
  if (foreign) {
    throw new NotFoundError(
      'Both runs must belong to this scenario or the scenario it was cloned from.',
    );
  }

  if (!base.metrics || !variant.metrics) {
    throw new ValidationError('Both runs must have stored metrics before they can be compared.');
  }

  const notes: string[] = [];
  if (base.scenarioId !== variant.scenarioId) {
    notes.push(
      'The runs come from different scenarios; metric differences include every simulator edit made between them.',
    );
  }
  if (base.scenarioId === variant.scenarioId) {
    notes.push('Both runs used the same scenario, so any difference comes from the run parameters.');
  }
  if (JSON.stringify(base.algorithmConfig) !== JSON.stringify(variant.algorithmConfig)) {
    notes.push(
      'The algorithm configuration differs between the runs; part of each delta comes from those parameters, not from the scenario edits.',
    );
  }
  if (base.algorithmConfig?.aco?.seed !== variant.algorithmConfig?.aco?.seed) {
    notes.push('The ACO seeds differ, so route-order costs are not directly reproducible across runs.');
  }
  if (base.status !== variant.status) {
    notes.push(`Run status changed from "${base.status}" to "${variant.status}".`);
  }
  notes.push(
    'ACO is a heuristic: route and road-cost deltas include search variance. Allocation deltas come from the exact DP.',
  );

  const deltas = metricDeltas(
    {
      metrics: base.metrics,
      packagesAllocated: allocatedPackageCount(base.result),
      status: base.status,
    },
    {
      metrics: variant.metrics,
      packagesAllocated: allocatedPackageCount(variant.result),
      status: variant.status,
    },
  );

  return {
    scenarioId: scenario.id,
    base,
    variant,
    deltas,
    notes,
  };
}

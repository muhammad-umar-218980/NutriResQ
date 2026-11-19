/**
 * Builds the exact `ScenarioSnapshot` shape that `loadScenarioSnapshot()` returns,
 * but straight from `seed-data.ts`. This keeps the pure algorithm and pipeline
 * tests database-free while still exercising the real seed dataset.
 */

import { projectLocations } from '../../src/algorithms/lib/graph';
import {
  SEED_DONATIONS,
  SEED_DONORS,
  SEED_LOCATIONS,
  SEED_RECIPIENTS,
  SEED_ROADS,
  SEED_SCENARIO,
  SEED_SCENARIO_ID,
  SEED_VEHICLES,
  roadCostKm,
} from '../../src/db/seed-data';
import type {
  DonationRecord,
  DonorRecord,
  LocationRecord,
  RecipientRecord,
  RoadRecord,
  ScenarioSnapshot,
  VehicleRecord,
} from '../../src/types/domain';

/** Inside the seed's availability window and after its only expiry date. */
export const SEED_RUN_STARTED_AT = '2026-11-15T08:00:00.000Z';

function byNameThenId(a: { name: string; id: string }, b: { name: string; id: string }): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/**
 * Mirrors `scenario.repository.ts`:
 * - locations/donors/recipients/vehicles ordered by (name, id);
 * - donations ordered by (package_name, id);
 * - projected coordinates filled in at read time.
 */
export function buildSeedSnapshot(): ScenarioSnapshot {
  const locations: LocationRecord[] = SEED_LOCATIONS.map((location) => ({
    id: location.id,
    name: location.name,
    locationType: location.locationType,
    latitude: location.latitude,
    longitude: location.longitude,
    projectedX: 0,
    projectedY: 0,
  })).sort(byNameThenId);

  const projected = projectLocations(locations);
  for (const location of locations) {
    const point = projected.get(location.id);
    if (point) {
      location.projectedX = point.x;
      location.projectedY = point.y;
    }
  }

  const roads: RoadRecord[] = SEED_ROADS.map((road) => ({
    id: road.id,
    scenarioId: SEED_SCENARIO_ID,
    fromLocationId: SEED_LOCATIONS[road.fromIndex - 1].id,
    toLocationId: SEED_LOCATIONS[road.toIndex - 1].id,
    cost: roadCostKm(road),
    costUnit: 'km',
    isAvailable: road.isAvailable ?? true,
    isBidirectional: road.isBidirectional ?? true,
  })).sort((a, b) => a.id.localeCompare(b.id));

  const donors: DonorRecord[] = SEED_DONORS.map((donor) => ({
    id: donor.id,
    scenarioId: SEED_SCENARIO_ID,
    locationId: SEED_LOCATIONS[donor.locationIndex - 1].id,
    name: donor.name,
    donorType: donor.donorType,
    isActive: true,
  })).sort(byNameThenId);

  const recipients: RecipientRecord[] = SEED_RECIPIENTS.map((recipient) => ({
    id: recipient.id,
    scenarioId: SEED_SCENARIO_ID,
    locationId: SEED_LOCATIONS[recipient.locationIndex - 1].id,
    name: recipient.name,
    recipientType: recipient.recipientType,
    demandUnits: recipient.demandUnits,
    priorityScore: recipient.priorityScore,
    isAvailable: true,
  })).sort(byNameThenId);

  const donorById = new Map(donors.map((donor) => [donor.id, donor]));
  const recipientById = new Map(recipients.map((recipient) => [recipient.id, recipient]));

  const donations: DonationRecord[] = SEED_DONATIONS.map((donation) => {
    const seedDonor = SEED_DONORS[donation.donorIndex - 1];
    const seedRecipient = donation.recipientIndex
      ? SEED_RECIPIENTS[donation.recipientIndex - 1]
      : null;

    const donor = donorById.get(seedDonor.id);
    const recipient = seedRecipient ? recipientById.get(seedRecipient.id) : null;
    if (!donor) throw new Error(`Seed donation ${donation.id} refers to an unknown donor id.`);

    return {
      id: donation.id,
      scenarioId: SEED_SCENARIO_ID,
      donorId: donor.id,
      packageName: donation.packageName,
      weightUnits: donation.weightUnits,
      valueScore: donation.valueScore,
      recipientId: recipient?.id ?? null,
      availableAt: donation.availableAt,
      expiresAt: donation.expiresAt,
      isEligible: donation.isEligible,
      status: donation.status,
      donorLocationId: donor.locationId,
      recipientLocationId: recipient?.locationId ?? null,
      recipientPriority: recipient?.priorityScore ?? 1,
    };
  }).sort(
    (a, b) => a.packageName.localeCompare(b.packageName) || a.id.localeCompare(b.id),
  );

  const vehicles: VehicleRecord[] = SEED_VEHICLES.map((vehicle) => ({
    id: vehicle.id,
    scenarioId: SEED_SCENARIO_ID,
    name: vehicle.name,
    capacityUnits: vehicle.capacityUnits,
    startLocationId: SEED_LOCATIONS[vehicle.startLocationIndex - 1].id,
    isAvailable: vehicle.isAvailable ?? true,
  })).sort(byNameThenId);

  return {
    scenarioId: SEED_SCENARIO_ID,
    scenarioName: SEED_SCENARIO.name,
    capturedAt: new Date().toISOString(),
    locations,
    roads,
    donors,
    recipients,
    donations,
    vehicles,
  };
}

/** Location id for a one-based seed index. */
export function seedLocationId(index: number): string {
  const location = SEED_LOCATIONS[index - 1];
  if (!location) throw new Error(`Seed location index ${index} is out of range.`);
  return location.id;
}

/** Location name for a one-based seed index. */
export function seedLocationName(index: number): string {
  const location = SEED_LOCATIONS[index - 1];
  if (!location) throw new Error(`Seed location index ${index} is out of range.`);
  return location.name;
}

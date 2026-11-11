import { ForbiddenError, NotFoundError, ValidationError } from '../errors/app-error';
import {
  createDonationForDonor,
  createVehicleForOwner,
  deleteDonationForDonor,
  deleteVehicleForOwner,
  findDonorForUser,
  findRecipientForUser,
  listAssignmentsForOwner,
  listDonationsForDonor,
  listDonationsForRecipient,
  listPortalScenarios,
  listRecipientOptionsForScenario,
  listScenarioLocations,
  listVehiclesForOwner,
  scenarioExists,
  scenarioHasLocation,
  scenarioHasRecipient,
  updateDonationForDonor,
  updateRecipientForUser,
  updateVehicleForOwner,
  type DonationInput,
  type OwnedDonor,
  type PortalDonation,
  type PortalScenario,
  type PortalVehicle,
  type RecipientInput,
  type VehicleInput,
} from '../repositories/portal.repository';
import type {
  DonationCreateBody,
  RecipientUpdateBody,
  VehicleCreateBody,
} from '../schemas/portal.schema';

/**
 * Role-scoped portal behaviour. The repositories already filter every statement
 * by the signed-in user's ownership column; this layer turns the raw results
 * into honest errors instead of empty pages.
 */

async function requireDonor(userId: string): Promise<OwnedDonor> {
  const donor = await findDonorForUser(userId);
  if (!donor) {
    throw new NotFoundError(
      'No food-donor record is linked to this account yet. Ask an administrator to link one.',
    );
  }
  return donor;
}

function toDonationInput(body: DonationCreateBody): DonationInput {
  return {
    packageName: body.packageName,
    weightUnits: body.weightUnits,
    valueScore: body.valueScore,
    recipientId: body.recipientId ?? null,
    availableAt: body.availableAt ?? null,
    expiresAt: body.expiresAt ?? null,
    isEligible: body.isEligible ?? true,
    status: body.status ?? 'available',
  };
}

export interface DonorWorkspace {
  donor: OwnedDonor;
  donations: PortalDonation[];
  recipients: Array<{ id: string; name: string }>;
}

export async function getDonorWorkspace(userId: string): Promise<DonorWorkspace> {
  const donor = await requireDonor(userId);
  const [donations, recipients] = await Promise.all([
    listDonationsForDonor(donor.id),
    listRecipientOptionsForScenario(donor.scenarioId),
  ]);
  return { donor, donations, recipients };
}

async function assertRecipientBelongsToScenario(
  scenarioId: string,
  recipientId: string | null,
): Promise<void> {
  if (recipientId === null) return;
  const belongs = await scenarioHasRecipient(scenarioId, recipientId);
  if (!belongs) {
    throw new ValidationError('That recipient does not belong to this scenario.');
  }
}

export async function createDonation(
  userId: string,
  body: DonationCreateBody,
): Promise<PortalDonation> {
  const donor = await requireDonor(userId);
  if (!donor.isActive) throw new ForbiddenError('This donor record is not active.');
  if (!Number.isInteger(body.weightUnits) || body.weightUnits <= 0) {
    throw new ValidationError('Weight must be a positive whole number of kilograms.');
  }
  const input = toDonationInput(body);
  await assertRecipientBelongsToScenario(donor.scenarioId, input.recipientId);
  return createDonationForDonor(donor, input);
}

export async function updateDonation(
  userId: string,
  donationId: string,
  body: DonationCreateBody,
): Promise<PortalDonation> {
  const donor = await requireDonor(userId);
  const input = toDonationInput(body);
  await assertRecipientBelongsToScenario(donor.scenarioId, input.recipientId);
  const updated = await updateDonationForDonor(donor.id, donationId, input);
  if (!updated) throw new NotFoundError('No donation of yours matches that id.');
  return updated;
}

export async function removeDonation(userId: string, donationId: string): Promise<void> {
  const donor = await requireDonor(userId);
  const deleted = await deleteDonationForDonor(donor.id, donationId);
  if (!deleted) throw new NotFoundError('No donation of yours matches that id.');
}

export interface RecipientWorkspace {
  recipient: Awaited<ReturnType<typeof findRecipientForUser>>;
  donations: PortalDonation[];
}

export async function getRecipientWorkspace(userId: string): Promise<RecipientWorkspace> {
  const recipient = await findRecipientForUser(userId);
  if (!recipient) {
    throw new NotFoundError(
      'No food-recipient record is linked to this account yet. Ask an administrator to link one.',
    );
  }
  const donations = await listDonationsForRecipient(recipient.id);
  return { recipient, donations };
}

export async function updateRecipientProfile(
  userId: string,
  body: RecipientUpdateBody,
): Promise<NonNullable<RecipientWorkspace['recipient']>> {
  const current = await findRecipientForUser(userId);
  if (!current) {
    throw new NotFoundError(
      'No food-recipient record is linked to this account yet. Ask an administrator to link one.',
    );
  }

  const input: RecipientInput = {
    recipientType:
      body.recipientType === undefined ? current.recipientType : body.recipientType,
    demandUnits: body.demandUnits ?? current.demandUnits,
    priorityScore: body.priorityScore ?? current.priorityScore,
    isAvailable: body.isAvailable ?? current.isAvailable,
  };

  if (!Number.isInteger(input.demandUnits) || input.demandUnits < 0) {
    throw new ValidationError('Demand must be a whole number of kilograms, zero or more.');
  }
  if (
    !Number.isInteger(input.priorityScore) ||
    input.priorityScore < 0 ||
    input.priorityScore > 100
  ) {
    throw new ValidationError('Priority must be a whole number between 0 and 100.');
  }

  const updated = await updateRecipientForUser(userId, input);
  if (!updated) throw new NotFoundError('No food-recipient record is linked to this account.');
  return updated;
}

export interface DeliveryWorkspace {
  vehicles: PortalVehicle[];
  assignments: Awaited<ReturnType<typeof listAssignmentsForOwner>>;
  scenarios: PortalScenario[];
}

export async function getDeliveryWorkspace(userId: string): Promise<DeliveryWorkspace> {
  const [vehicles, assignments, scenarios] = await Promise.all([
    listVehiclesForOwner(userId),
    listAssignmentsForOwner(userId),
    listPortalScenarios(),
  ]);
  return { vehicles, assignments, scenarios };
}

export async function getScenarios(): Promise<PortalScenario[]> {
  return listPortalScenarios();
}

export async function getScenarioLocations(scenarioId: string) {
  const exists = await scenarioExists(scenarioId);
  if (!exists) throw new NotFoundError('No scenario matches that id.');
  return listScenarioLocations(scenarioId);
}

async function assertVehicleScope(input: VehicleInput): Promise<void> {
  const exists = await scenarioExists(input.scenarioId);
  if (!exists) throw new ValidationError('That scenario does not exist.');
  if (input.startLocationId) {
    const belongs = await scenarioHasLocation(input.scenarioId, input.startLocationId);
    if (!belongs) {
      throw new ValidationError('The start location is not part of that scenario.');
    }
  }
}

function toVehicleInput(body: VehicleCreateBody): VehicleInput {
  return {
    scenarioId: body.scenarioId,
    name: body.name,
    capacityUnits: body.capacityUnits,
    startLocationId: body.startLocationId ?? null,
    isAvailable: body.isAvailable ?? true,
  };
}

export async function createVehicle(
  userId: string,
  body: VehicleCreateBody,
): Promise<PortalVehicle> {
  if (!Number.isInteger(body.capacityUnits) || body.capacityUnits <= 0) {
    throw new ValidationError('Capacity must be a positive whole number of kilograms.');
  }
  const input = toVehicleInput(body);
  await assertVehicleScope(input);
  return createVehicleForOwner(userId, input);
}

export async function updateVehicle(
  userId: string,
  vehicleId: string,
  body: VehicleCreateBody,
): Promise<PortalVehicle> {
  if (!Number.isInteger(body.capacityUnits) || body.capacityUnits <= 0) {
    throw new ValidationError('Capacity must be a positive whole number of kilograms.');
  }
  const input = toVehicleInput(body);
  await assertVehicleScope(input);
  const updated = await updateVehicleForOwner(userId, vehicleId, input);
  if (!updated) throw new NotFoundError('No vehicle of yours matches that id.');
  return updated;
}

export async function removeVehicle(userId: string, vehicleId: string): Promise<void> {
  const deleted = await deleteVehicleForOwner(userId, vehicleId);
  if (!deleted) throw new NotFoundError('No vehicle of yours matches that id.');
}

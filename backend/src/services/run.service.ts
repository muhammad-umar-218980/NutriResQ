import { createHash } from 'node:crypto';
import { withTransaction } from '../db/pool';
import { NotFoundError, ValidationError } from '../errors/app-error';
import {
  findRunById,
  finalizeRun,
  insertBenchmarks,
  insertRunningRun,
  listRunsForScenario,
  persistRunDetails,
  type ScenarioRunList,
} from '../repositories/run.repository';
import { loadScenarioSnapshot } from '../repositories/scenario.repository';
import {
  resolveAlgorithmConfig,
  runOptimization,
  type AlgorithmConfigOverrides,
} from './optimization.service';
import type { RunDetail } from '../types/domain';

export interface OptimizeRequest {
  scenarioId: string;
  runBy: string | null;
  overrides?: AlgorithmConfigOverrides;
}

/**
 * Load the immutable snapshot, run the pure pipeline, and persist everything
 * transactionally. A run is inserted as `running` first so a crashed process
 * leaves an honest record instead of a silent gap.
 */
export async function createOptimizationRun(request: OptimizeRequest): Promise<RunDetail> {
  const snapshot = await loadScenarioSnapshot(request.scenarioId);
  if (!snapshot) throw new NotFoundError('No scenario matches that id.');

  let config;
  try {
    config = resolveAlgorithmConfig(request.overrides ?? {});
  } catch (error) {
    throw new ValidationError(
      error instanceof Error ? error.message : 'The algorithm configuration is invalid.',
    );
  }

  const runStartedAt = new Date().toISOString();
  const runId = await insertRunningRun({
    scenarioId: request.scenarioId,
    runBy: request.runBy,
    algorithmConfig: config,
    inputSnapshot: snapshot,
    startedAt: runStartedAt,
  });

  try {
    const outcome = runOptimization({ snapshot, config, runStartedAt });
    const completedAt = new Date().toISOString();

    const donationById = new Map(snapshot.donations.map((donation) => [donation.id, donation]));
    const vehicleById = new Map(snapshot.vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const locationById = new Map(snapshot.locations.map((location) => [location.id, location]));

    const fingerprint = createHash('sha256')
      .update(JSON.stringify(snapshot))
      .digest('hex');

    await withTransaction(async (client) => {
      await persistRunDetails(client, {
        runId,
        result: outcome.result,
        labels: {
          vehicleName: (vehicleId) => vehicleById.get(vehicleId)?.name ?? vehicleId,
          donationName: (donationId) =>
            donationById.get(donationId)?.packageName ?? donationId,
          locationName: (locationId) => locationById.get(locationId)?.name ?? locationId,
          donationInfo: (donationId) => {
            const donation = donationById.get(donationId);
            if (!donation) return null;
            return {
              weightUnits: donation.weightUnits,
              objectiveValue: donation.valueScore * donation.recipientPriority,
            };
          },
        },
      });

      await insertBenchmarks(client, {
        runId,
        scenarioId: request.scenarioId,
        inputFingerprint: fingerprint,
        benchmarks: outcome.benchmarks,
      });

      await finalizeRun(client, {
        runId,
        status: outcome.result.status,
        metrics: outcome.result.metrics,
        warnings: outcome.result.warnings,
        result: outcome.result,
        errorCode: outcome.result.errors.length > 0 ? 'OPTIMIZATION_FAILED' : null,
        errorMessage:
          outcome.result.errors.length > 0 ? outcome.result.errors.join(' ') : null,
        completedAt,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await withTransaction(async (client) => {
      await finalizeRun(client, {
        runId,
        status: 'failed',
        metrics: null,
        warnings: [],
        result: null,
        errorCode: 'RUN_FAILED',
        errorMessage: message,
        completedAt: new Date().toISOString(),
      });
    }).catch(() => undefined);
    throw error;
  }

  const detail = await findRunById(runId);
  if (!detail) throw new Error('The run was saved but could not be reloaded.');
  return detail;
}

export async function getRun(runId: string): Promise<RunDetail> {
  const run = await findRunById(runId);
  if (!run) throw new NotFoundError('No optimization run matches that id.');
  return run;
}

export async function getScenarioRuns(
  scenarioId: string,
  page: number,
  pageSize: number,
): Promise<ScenarioRunList> {
  return listRunsForScenario(scenarioId, page, pageSize);
}

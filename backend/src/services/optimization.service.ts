/**
 * Pure optimization pipeline (ARCHITECTURE.md section 6).
 *
 * This module performs no SQL and no HTTP work. It receives an immutable input
 * snapshot plus a resolved algorithm configuration and returns the full result
 * object, measured benchmarks, and honest warnings. Persistence lives in
 * run.service.ts.
 *
 * Pipeline order:
 *  1. Validate inputs (fatal issues abort with status `failed`).
 *  2. Build the road graph (closed roads excluded).
 *  3. Donation eligibility (expired / ineligible / not yet available).
 *  4. Multiple-knapsack DP allocation, then oversize/unallocated reporting.
 *  5. Route stops derived from the allocation only.
 *  6. A* travel-cost matrix and ACO ordering, nearest-neighbour benchmark.
 *  7. Closest pair (straight-line projected distance) and brute-force benchmark.
 *  8. Post-validation, metrics and status.
 */

import { optimizeRouteWithACO, createDefaultACOConfig, type ACOConfig } from '../algorithms/aco';
import { aStarSearch } from '../algorithms/astar';
import { bruteForceClosestPair } from '../algorithms/brute-force-closest-pair';
import { findClosestPair } from '../algorithms/closest-pair';
import { greedyKnapsackAllocation, type GreedyPackage } from '../algorithms/greedy-knapsack';
import {
  buildHeuristic,
  buildRoadGraph,
  projectLocations,
  type RoadGraph,
} from '../algorithms/lib/graph';
import { nearestNeighborRoute } from '../algorithms/nearest-neighbor';
import {
  solveMultipleKnapsack,
  type MultipleKnapsackResult,
} from '../algorithms/multiple-knapsack-dp';
import type { RouteJob } from '../algorithms/lib/route';
import type {
  AlgorithmConfig,
  Allocation,
  BenchmarkRecord,
  ClosestPairResult,
  DonationRecord,
  Metrics,
  OptimizationResult,
  RouteLeg,
  RouteStop,
  ScenarioSnapshot,
  UnallocatedPackage,
  UnreachablePair,
  VehicleRecord,
  VehicleRoute,
  Warning,
} from '../types/domain';

export const ALGORITHM_VERSION = '2.0.0';
export const DEFAULT_MAX_STATES = 250_000;
export const DEFAULT_MAX_CONNECTIVITY_PAIRS = 2_000;

export interface AlgorithmConfigOverrides {
  astarHeuristic?: AlgorithmConfig['astarHeuristic'];
  knapsack?: Partial<AlgorithmConfig['knapsack']>;
  aco?: Partial<AlgorithmConfig['aco']>;
  closestPair?: Partial<AlgorithmConfig['closestPair']>;
}

export interface OptimizationInput {
  snapshot: ScenarioSnapshot;
  config: AlgorithmConfig;
  /** ISO timestamp the run began; expiry is evaluated against this instant. */
  runStartedAt: string;
}

export interface OptimizationOutcome {
  result: OptimizationResult;
  benchmarks: BenchmarkRecord[];
}

/**
 * Resolve caller overrides into a complete, validated algorithm configuration.
 * Throws RangeError for values outside the documented limits.
 */
export function resolveAlgorithmConfig(overrides: AlgorithmConfigOverrides = {}): AlgorithmConfig {
  const maxStates = overrides.knapsack?.maxStates ?? DEFAULT_MAX_STATES;
  if (!Number.isInteger(maxStates) || maxStates <= 0) {
    throw new RangeError('knapsack.maxStates must be a positive integer.');
  }

  const aco = {
    numAnts: overrides.aco?.numAnts ?? 0,
    numTrials: overrides.aco?.numTrials ?? 20,
    evaporationRate: overrides.aco?.evaporationRate ?? 0.5,
    alpha: overrides.aco?.alpha ?? 1,
    beta: overrides.aco?.beta ?? 2,
    seed: overrides.aco?.seed ?? -1,
  };

  if (!Number.isInteger(aco.numAnts) || aco.numAnts < 0) {
    throw new RangeError('aco.numAnts must be 0 (auto) or a positive integer.');
  }
  if (!Number.isInteger(aco.numTrials) || aco.numTrials < 1 || aco.numTrials > 10_000) {
    throw new RangeError('aco.numTrials must be an integer between 1 and 10000.');
  }
  if (!(aco.evaporationRate > 0 && aco.evaporationRate < 1)) {
    throw new RangeError('aco.evaporationRate must be strictly between 0 and 1.');
  }
  if (!(aco.alpha >= 0) || !(aco.beta >= 0)) {
    throw new RangeError('aco.alpha and aco.beta must be non-negative.');
  }
  if (!Number.isInteger(aco.seed) || aco.seed < -1) {
    throw new RangeError('aco.seed must be an integer (-1 draws a fresh seed).');
  }

  return {
    astarHeuristic: overrides.astarHeuristic ?? 'projected-distance',
    knapsack: {
      valueFormula: 'value_score * recipient_priority',
      maxStates,
    },
    aco,
    closestPair: {
      projection: 'equirectangular-meters',
      units: 'meters',
    },
    algorithmVersion: ALGORITHM_VERSION,
  };
}

interface LocationPoint {
  x: number;
  y: number;
}

/** A donation that passed the eligibility rules and can be considered by the DP. */
interface Candidate {
  donation: DonationRecord;
  donorLocationId: string;
  weightUnits: number;
  value: number;
  priority: number;
}

interface PathResult {
  cost: number;
  path: string[];
  reached: boolean;
}

const CAPACITY_REASONS = new Set<UnallocatedPackage['reason']>([
  'oversized',
  'insufficient_capacity',
  'no_vehicle',
  'state_limit_exceeded',
]);

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function addWarning(warnings: Warning[], warning: Warning): void {
  if (!warnings.some((entry) => entry.code === warning.code && entry.message === warning.message)) {
    warnings.push(warning);
  }
}

function emptyMetrics(runtimeMs: number): Metrics {
  return {
    allocatedPackageValue: 0,
    allocatedPackageWeightUnits: 0,
    unallocatedPackageCount: 0,
    vehicleCapacityUtilization: 0,
    totalRoadCost: 0,
    totalRoadCostUnit: 'km',
    reachablePairCount: 0,
    unreachablePairCount: 0,
    routeCount: 0,
    partialRouteCount: 0,
    runtimeMs,
  };
}

/**
 * Run the integrated optimization pipeline. Synchronous and deterministic for a
 * fixed snapshot, config and seed.
 */
export function runOptimization(input: OptimizationInput): OptimizationOutcome {
  const startedAt = performance.now();
  const { snapshot, config } = input;
  const runStartedAt = new Date(input.runStartedAt);
  const runStartedMs = runStartedAt.getTime();

  const warnings: Warning[] = [];
  const errors: string[] = [];
  const benchmarks: BenchmarkRecord[] = [];
  const unreachableByKey = new Map<string, UnreachablePair>();
  const locationById = new Map(snapshot.locations.map((location) => [location.id, location]));
  const donationById = new Map(snapshot.donations.map((donation) => [donation.id, donation]));

  const runSeed =
    config.aco.seed >= 0 ? config.aco.seed : Math.floor(Date.now() % 2_147_483_647);
  const resolvedConfig: AlgorithmConfig = {
    ...config,
    aco: { ...config.aco, seed: runSeed },
  };

  const nameOf = (locationId: string): string =>
    locationById.get(locationId)?.name ?? locationId;
  const donationName = (donationId: string): string =>
    donationById.get(donationId)?.packageName ?? donationId;

  const roadUnit = snapshot.roads.find((road) => road.costUnit)?.costUnit ?? 'km';

  // 2. Road graph. Closed roads stay stored but are excluded from the run graph.
  const graph: RoadGraph = buildRoadGraph(snapshot.roads);
  const projected = projectLocations(snapshot.locations);

  const heuristics = new Map<string, (nodeId: string | number) => number>();
  const heuristicFor = (goalId: string): ((nodeId: string | number) => number) => {
    const cached = heuristics.get(goalId);
    if (cached) return cached;
    const base =
      config.astarHeuristic === 'zero'
        ? () => 0
        : buildHeuristic(roadUnit, projected, goalId);
    const heuristic = (nodeId: string | number): number =>
      base(typeof nodeId === 'string' ? nodeId : String(nodeId));
    heuristics.set(goalId, heuristic);
    return heuristic;
  };

  const pathMemo = new Map<string, PathResult>();
  const findPath = (fromLocationId: string, toLocationId: string): PathResult => {
    if (fromLocationId === toLocationId) {
      return { cost: 0, path: [fromLocationId], reached: true };
    }
    const key = `${fromLocationId}|${toLocationId}`;
    const cached = pathMemo.get(key);
    if (cached) return cached;

    const result = aStarSearch(graph, fromLocationId, toLocationId, heuristicFor(toLocationId));
    const computed: PathResult = {
      cost: result.reached ? result.totalCost : Infinity,
      path: result.reached ? (result.path as string[]) : [],
      reached: result.reached,
    };
    pathMemo.set(key, computed);
    return computed;
  };

  const getCost = (fromLocationId: string, toLocationId: string): number =>
    findPath(fromLocationId, toLocationId).cost;

  // 1 + 3. Eligibility. Fatal input problems are reported instead of guessed.
  const fatalLocations = snapshot.locations.filter(
    (location) => !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude),
  );
  if (fatalLocations.length > 0) {
    errors.push(
      `${fatalLocations.length} location(s) have non-finite coordinates: ${fatalLocations
        .map((location) => location.name)
        .join(', ')}.`,
    );

    return {
      result: {
        status: 'failed',
        metrics: emptyMetrics(round(performance.now() - startedAt, 1)),
        allocations: [],
        unallocated: [],
        routes: [],
        unreachable: [],
        closestPair: null,
        warnings,
        errors,
        algorithmConfig: resolvedConfig,
        inputCounts: {
          locations: snapshot.locations.length,
          roads: snapshot.roads.length,
          availableRoads: snapshot.roads.filter((road) => road.isAvailable).length,
          donations: snapshot.donations.length,
          eligibleDonations: 0,
          vehicles: snapshot.vehicles.length,
          availableVehicles: 0,
        },
      },
      benchmarks,
    };
  }

  const candidateList: Candidate[] = [];
  const unallocated: UnallocatedPackage[] = [];
  let ruleEligibleCount = 0;

  for (const donation of snapshot.donations) {
    const fail = (reason: UnallocatedPackage['reason'], detail: string): void => {
      unallocated.push({
        donationId: donation.id,
        packageName: donation.packageName,
        weightUnits: donation.weightUnits,
        valueScore: donation.valueScore,
        reason,
        detail,
      });
    };

    if (!donation.isEligible) {
      fail('ineligible', 'Marked ineligible in the source data.');
      continue;
    }
    if (donation.status === 'reserved' || donation.status === 'unavailable') {
      fail('not_available', `Donation status is "${donation.status}".`);
      continue;
    }
    if (donation.status === 'expired') {
      fail('expired', 'Donation status is "expired".');
      continue;
    }
    if (donation.expiresAt && new Date(donation.expiresAt).getTime() <= runStartedMs) {
      fail('expired', `Expired at ${donation.expiresAt}, before the run started.`);
      continue;
    }
    if (donation.availableAt && new Date(donation.availableAt).getTime() > runStartedMs) {
      fail('not_available', `Only available from ${donation.availableAt}.`);
      continue;
    }
    if (!donation.donorLocationId) {
      fail('not_available', 'The donation has no donor location, so it cannot be collected.');
      continue;
    }
    if (!Number.isInteger(donation.weightUnits) || donation.weightUnits <= 0) {
      fail('ineligible', `Weight must be a positive integer number of units, got ${donation.weightUnits}.`);
      continue;
    }

    ruleEligibleCount++;

    candidateList.push({
      donation,
      donorLocationId: donation.donorLocationId,
      weightUnits: donation.weightUnits,
      value: donation.valueScore * donation.recipientPriority,
      priority: donation.recipientPriority,
    });
  }

  // Vehicles without a start location cannot be routed and are not offered to the DP.
  const usableVehicles: VehicleRecord[] = [];
  for (const vehicle of snapshot.vehicles) {
    if (!vehicle.isAvailable) continue;
    if (!vehicle.startLocationId) {
      addWarning(warnings, {
        code: 'vehicle-missing-start',
        message: `Vehicle "${vehicle.name}" has no start location and was excluded from allocation.`,
        entityType: 'vehicle',
        entityId: vehicle.id,
      });
      continue;
    }
    usableVehicles.push(vehicle);
  }

  const maxCapacity = usableVehicles.reduce(
    (max, vehicle) => Math.max(max, vehicle.capacityUnits),
    0,
  );

  const allocatable: Candidate[] = [];
  for (const candidate of candidateList) {
    if (usableVehicles.length === 0) {
      unallocated.push({
        donationId: candidate.donation.id,
        packageName: candidate.donation.packageName,
        weightUnits: candidate.weightUnits,
        valueScore: candidate.donation.valueScore,
        reason: 'no_vehicle',
        detail: 'No available vehicle has a start location.',
      });
      continue;
    }
    if (candidate.weightUnits > maxCapacity) {
      unallocated.push({
        donationId: candidate.donation.id,
        packageName: candidate.donation.packageName,
        weightUnits: candidate.weightUnits,
        valueScore: candidate.donation.valueScore,
        reason: 'oversized',
        detail: `Package weighs ${candidate.weightUnits} units; the largest available vehicle holds ${maxCapacity}.`,
      });
      continue;
    }
    allocatable.push(candidate);
  }

  // 4. Exact multiple-knapsack DP.
  let dpResult: MultipleKnapsackResult | null = null;
  let greedyResult: ReturnType<typeof greedyKnapsackAllocation> | null = null;
  let dpRuntimeMs = 0;

  const dpStartedAt = performance.now();
  try {
    dpResult = solveMultipleKnapsack(
      allocatable.map((candidate) => ({
        id: candidate.donation.id,
        weightUnits: candidate.weightUnits,
        value: candidate.value,
      })),
      usableVehicles.map((vehicle) => vehicle.capacityUnits),
      { maxStates: config.knapsack.maxStates },
    );
    dpRuntimeMs = performance.now() - dpStartedAt;
  } catch (error) {
    dpRuntimeMs = performance.now() - dpStartedAt;
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
    for (const candidate of allocatable) {
      unallocated.push({
        donationId: candidate.donation.id,
        packageName: candidate.donation.packageName,
        weightUnits: candidate.weightUnits,
        valueScore: candidate.donation.valueScore,
        reason: 'state_limit_exceeded',
        detail: 'The exact DP was not run because the configured state limit was exceeded.',
      });
    }
  }

  // 5 + 6. Route stops, A* legs and ACO ordering per vehicle.
  const allocations: Allocation[] = [];
  const routes: VehicleRoute[] = [];
  const acoVehicleBenchmarks: Array<Record<string, unknown>> = [];
  let acoTotalCost = 0;
  let nearestNeighborTotalCost = 0;
  let acoRuntimeMs = 0;
  let nearestNeighborRuntimeMs = 0;

  const assignmentByVehicle = new Map<number, number[]>();
  if (dpResult) {
    for (const assignment of dpResult.assignments) {
      assignmentByVehicle.set(assignment.vehicleIndex, assignment.itemIndexes);
    }
  }

  for (let vehicleIndex = 0; vehicleIndex < usableVehicles.length; vehicleIndex++) {
    const vehicle = usableVehicles[vehicleIndex];
    const itemIndexes = assignmentByVehicle.get(vehicleIndex) ?? [];
    const assigned = itemIndexes.map((index) => allocatable[index]).filter(Boolean);

    const totalWeightUnits = assigned.reduce((sum, candidate) => sum + candidate.weightUnits, 0);
    const totalValue = assigned.reduce((sum, candidate) => sum + candidate.value, 0);

    allocations.push({
      vehicleId: vehicle.id,
      donationIds: assigned.map((candidate) => candidate.donation.id),
      totalWeightUnits,
      totalValue,
      capacityUnits: vehicle.capacityUnits,
      utilization:
        vehicle.capacityUnits > 0 ? (totalWeightUnits / vehicle.capacityUnits) * 100 : 0,
    });

    if (assigned.length === 0) {
      routes.push({
        vehicleId: vehicle.id,
        status: 'not_required',
        totalCost: 0,
        costUnit: roadUnit,
        stops: [],
        legs: [],
        algorithmName: 'none',
        algorithmConfig: {},
      });
      continue;
    }

    const depot = vehicle.startLocationId!;
    const jobs: RouteJob[] = assigned.map((candidate) => {
      const fallback = candidate.donation.recipientLocationId === null;
      if (fallback) {
        addWarning(warnings, {
          code: 'delivery-fallback-depot',
          message:
            `"${candidate.donation.packageName}" has no intended recipient and is delivered to the ` +
            `vehicle start location (${nameOf(depot)}).`,
          entityType: 'donation',
          entityId: candidate.donation.id,
        });
      }
      return {
        id: candidate.donation.id,
        pickupLocationId: candidate.donorLocationId,
        deliveryLocationId: candidate.donation.recipientLocationId ?? depot,
      };
    });

    const numAnts =
      resolvedConfig.aco.numAnts > 0
        ? resolvedConfig.aco.numAnts
        : createDefaultACOConfig(jobs.length).numAnts;

    const acoConfig: ACOConfig = createDefaultACOConfig(jobs.length, {
      numAnts,
      numTrials: resolvedConfig.aco.numTrials,
      evaporationRate: resolvedConfig.aco.evaporationRate,
      alpha: resolvedConfig.aco.alpha,
      beta: resolvedConfig.aco.beta,
      seed: runSeed,
    });

    const acoStartedAt = performance.now();
    const aco = optimizeRouteWithACO(depot, jobs, getCost, acoConfig);
    const vehicleAcoMs = performance.now() - acoStartedAt;
    acoRuntimeMs += vehicleAcoMs;

    const nnStartedAt = performance.now();
    const nearestNeighbour = nearestNeighborRoute(depot, jobs, getCost, { seed: runSeed });
    const vehicleNnMs = performance.now() - nnStartedAt;
    nearestNeighborRuntimeMs += vehicleNnMs;

    acoTotalCost += Number.isFinite(aco.totalCost) ? aco.totalCost : 0;
    nearestNeighborTotalCost += Number.isFinite(nearestNeighbour.totalCost)
      ? nearestNeighbour.totalCost
      : 0;

    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    const candidateByDonation = new Map(
      assigned.map((candidate) => [candidate.donation.id, candidate]),
    );

    const legs: RouteLeg[] = [];
    const stops: RouteStop[] = [];
    let sequenceNumber = 1;

    stops.push({
      sequenceNumber,
      locationId: depot,
      stopType: 'start',
      relatedDonationId: null,
      relatedRecipientId: null,
      legCostFromPrevious: null,
      legPath: [],
    });

    let current = depot;
    let routeCost = 0;
    let covered = 0;

    for (const jobId of aco.order) {
      const job = jobsById.get(jobId);
      const candidate = candidateByDonation.get(jobId);
      if (!job || !candidate) continue;

      const toPickup = findPath(current, job.pickupLocationId);
      if (!toPickup.reached) {
        const key = `${current}|${job.pickupLocationId}`;
        if (!unreachableByKey.has(key)) {
          unreachableByKey.set(key, {
            fromLocationId: current,
            toLocationId: job.pickupLocationId,
            fromName: nameOf(current),
            toName: nameOf(job.pickupLocationId),
            reason: 'No path exists through available roads.',
          });
        }
        continue;
      }

      const toDelivery = findPath(job.pickupLocationId, job.deliveryLocationId);
      if (!toDelivery.reached) {
        const key = `${job.pickupLocationId}|${job.deliveryLocationId}`;
        if (!unreachableByKey.has(key)) {
          unreachableByKey.set(key, {
            fromLocationId: job.pickupLocationId,
            toLocationId: job.deliveryLocationId,
            fromName: nameOf(job.pickupLocationId),
            toName: nameOf(job.deliveryLocationId),
            reason: 'No path exists through available roads.',
          });
        }
        continue;
      }

      legs.push({
        fromLocationId: current,
        toLocationId: job.pickupLocationId,
        cost: toPickup.cost,
        path: toPickup.path,
      });
      routeCost += toPickup.cost;
      sequenceNumber++;
      stops.push({
        sequenceNumber,
        locationId: job.pickupLocationId,
        stopType: 'pickup',
        relatedDonationId: candidate.donation.id,
        relatedRecipientId: null,
        legCostFromPrevious: toPickup.cost,
        legPath: toPickup.path,
      });

      legs.push({
        fromLocationId: job.pickupLocationId,
        toLocationId: job.deliveryLocationId,
        cost: toDelivery.cost,
        path: toDelivery.path,
      });
      routeCost += toDelivery.cost;
      sequenceNumber++;
      stops.push({
        sequenceNumber,
        locationId: job.deliveryLocationId,
        stopType: 'delivery',
        relatedDonationId: candidate.donation.id,
        relatedRecipientId: candidate.donation.recipientId,
        legCostFromPrevious: toDelivery.cost,
        legPath: toDelivery.path,
      });

      current = job.deliveryLocationId;
      covered++;
    }

    let status: VehicleRoute['status'];
    let infeasibleReason: string | undefined;
    if (covered === jobs.length) {
      status = 'complete';
    } else if (covered > 0) {
      status = 'partial';
      infeasibleReason = `${
        jobs.length - covered
      } assigned stop(s) could not be connected: ${aco.unreachableJobs
        .map((job) => donationName(job.jobId))
        .join(', ')}.`;
    } else {
      status = 'infeasible';
      infeasibleReason =
        'None of the assigned stops could be reached from the vehicle start location.';
    }

    for (const job of aco.unreachableJobs) {
      const key = `${job.fromLocationId}|${job.toLocationId}`;
      if (!unreachableByKey.has(key)) {
        unreachableByKey.set(key, {
          fromLocationId: job.fromLocationId,
          toLocationId: job.toLocationId,
          fromName: nameOf(job.fromLocationId),
          toName: nameOf(job.toLocationId),
          reason: 'ACO could not connect this assigned stop from the route position.',
        });
      }
    }

    if (Math.abs(routeCost - aco.totalCost) > 1e-6 && Number.isFinite(aco.totalCost)) {
      addWarning(warnings, {
        code: 'route-cost-recomputed',
        message:
          `Route cost for "${vehicle.name}" was recomputed from A* legs ` +
          `(${round(routeCost, 3)} ${roadUnit}) instead of the ACO tour total.`,
        entityType: 'vehicle',
        entityId: vehicle.id,
      });
    }

    routes.push({
      vehicleId: vehicle.id,
      status,
      totalCost: round(routeCost, 6),
      costUnit: roadUnit,
      stops,
      legs,
      algorithmName: 'aco',
      algorithmConfig: {
        ...acoConfig,
        coveredJobs: covered,
        jobCount: jobs.length,
      },
      ...(infeasibleReason ? { infeasibleReason } : {}),
    });

    acoVehicleBenchmarks.push({
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      jobCount: jobs.length,
      acoTotalCost: round(aco.totalCost, 6),
      nearestNeighborTotalCost: round(nearestNeighbour.totalCost, 6),
      acoOrder: aco.order,
      nearestNeighborOrder: nearestNeighbour.order,
      acoUnreachableJobs: aco.unreachableJobs.length,
      nearestNeighborUnreachableJobs: nearestNeighbour.unreachableJobs.length,
      acoFeasible: aco.feasible,
      nearestNeighborFeasible: nearestNeighbour.feasible,
      acoRuntimeMs: round(vehicleAcoMs, 3),
      nearestNeighborRuntimeMs: round(vehicleNnMs, 3),
      seed: aco.seed,
      numTrials: aco.trials,
    });
  }

  if (dpResult) {
    // Greedy baseline runs on exactly the same candidate set and capacities.
    const greedyStartedAt = performance.now();
    greedyResult = greedyKnapsackAllocation(
      allocatable.map<GreedyPackage>((candidate, index) => ({
        id: index,
        weight: candidate.weightUnits,
        value: candidate.value,
        valueToWeightRatio:
          candidate.weightUnits > 0 ? candidate.value / candidate.weightUnits : 0,
      })),
      usableVehicles.map((vehicle, index) => ({
        id: index,
        capacity: vehicle.capacityUnits,
        maxCapacity: vehicle.capacityUnits,
        assignedPackages: [],
        totalWeight: 0,
        totalValue: 0,
      })),
    );
    const greedyRuntimeMs = performance.now() - greedyStartedAt;

    for (const entry of dpResult.unallocated) {
      const candidate = allocatable[entry.itemIndex];
      if (!candidate) continue;
      unallocated.push({
        donationId: candidate.donation.id,
        packageName: candidate.donation.packageName,
        weightUnits: candidate.weightUnits,
        valueScore: candidate.donation.valueScore,
        reason:
          entry.reason === 'oversized'
            ? 'oversized'
            : entry.reason === 'no_vehicle'
              ? 'no_vehicle'
              : 'insufficient_capacity',
        detail: entry.detail,
      });
    }

    const dpBenchmark: BenchmarkRecord = {
      algorithmName: 'multiple-knapsack-dp',
      baselineName: 'greedy-knapsack',
      configuration: {
        valueFormula: resolvedConfig.knapsack.valueFormula,
        maxStates: resolvedConfig.knapsack.maxStates,
        stateCount: dpResult.stateCount,
        exact: dpResult.exact,
        vehicles: usableVehicles.length,
        packages: allocatable.length,
      },
      resultSummary: {
        metric: 'allocated objective value (value_score * recipient_priority)',
        dpTotalValue: dpResult.totalValue,
        greedyTotalValue: greedyResult.metrics.totalValueAllocated,
        dpAllocatedWeightUnits: dpResult.totalWeightUnits,
        greedyAllocatedWeightUnits: greedyResult.metrics.totalWeightAllocated,
        dpUnallocatedCount: dpResult.unallocated.length,
        greedyUnallocatedCount: greedyResult.metrics.numUnallocated,
        dpRuntimeMs: round(dpRuntimeMs, 3),
        greedyRuntimeMs: round(greedyRuntimeMs, 3),
      },
      runtimeMs: round(dpRuntimeMs, 3),
      trialNumber: 1,
    };

    benchmarks.push(dpBenchmark);
  }

  // 6. Connectivity analysis over scenario location pairs.
  const allPairs = snapshot.locations.length * (snapshot.locations.length - 1);
  const analyzeAllPairs = allPairs <= DEFAULT_MAX_CONNECTIVITY_PAIRS;

  const analyzedKeys = new Set<string>();
  const reachableFrom = new Set<string>();
  const reachableTo = new Set<string>();
  let reachablePairCount = 0;

  const considerPair = (fromLocationId: string, toLocationId: string): void => {
    if (fromLocationId === toLocationId) return;
    const key = `${fromLocationId}|${toLocationId}`;
    if (analyzedKeys.has(key)) return;
    analyzedKeys.add(key);

    const path = findPath(fromLocationId, toLocationId);
    if (path.reached) {
      reachablePairCount++;
      reachableFrom.add(fromLocationId);
      reachableTo.add(toLocationId);
      return;
    }
    if (!unreachableByKey.has(key)) {
      unreachableByKey.set(key, {
        fromLocationId,
        toLocationId,
        fromName: nameOf(fromLocationId),
        toName: nameOf(toLocationId),
        reason: 'No path exists through available roads.',
      });
    }
  };

  if (analyzeAllPairs) {
    for (const from of snapshot.locations) {
      for (const to of snapshot.locations) {
        if (from.id !== to.id) considerPair(from.id, to.id);
      }
    }
  } else {
    for (const key of [...pathMemo.keys()]) {
      const [from, to] = key.split('|');
      if (from && to) considerPair(from, to);
    }
    addWarning(warnings, {
      code: 'network-analysis-truncated',
      message:
        `The scenario has ${allPairs} ordered location pairs, above the ` +
        `${DEFAULT_MAX_CONNECTIVITY_PAIRS}-pair analysis limit. Only pairs used by this run's ` +
        'routes were checked for reachability.',
    });
  }

  // A location is disconnected when nothing else can reach it or it can reach
  // nothing else. Merely being paired with an isolated node is not its fault.
  const disconnectedIds = new Set<string>();
  if (analyzeAllPairs) {
    for (const location of snapshot.locations) {
      const reachesSomeone = reachableFrom.has(location.id);
      const reachableBySomeone = reachableTo.has(location.id);
      if (!reachesSomeone || !reachableBySomeone) {
        disconnectedIds.add(location.id);
      }
    }
  }
  let disconnectedWarnings = 0;
  for (const locationId of disconnectedIds) {
    if (disconnectedWarnings >= 10) break;
    const location = locationById.get(locationId);
    if (!location) continue;
    addWarning(warnings, {
      code: 'location-disconnected',
      message: `"${location.name}" is not reachable from at least one other scenario location.`,
      entityType: 'location',
      entityId: location.id,
    });
    disconnectedWarnings++;
  }

  // 7. Closest pair on projected coordinates (straight-line, not road distance).
  const pointRecords = snapshot.locations
    .filter(
      (location) =>
        Number.isFinite(location.projectedX) && Number.isFinite(location.projectedY),
    )
    .map((location) => ({
      x: location.projectedX,
      y: location.projectedY,
      id: location.id,
      name: location.name,
    }));

  let closestPair: ClosestPairResult | null = null;

  if (pointRecords.length >= 2) {
    const dcStartedAt = performance.now();
    const dc = findClosestPair(pointRecords);
    const dcRuntimeMs = performance.now() - dcStartedAt;

    const bfStartedAt = performance.now();
    const bf = bruteForceClosestPair(pointRecords);
    const bfRuntimeMs = performance.now() - bfStartedAt;

    const dcP1 = dc.p1 as { id?: string; name?: string } | null;
    const dcP2 = dc.p2 as { id?: string; name?: string } | null;

    closestPair = {
      distanceMeters: Number.isFinite(dc.distance) ? round(dc.distance, 3) : null,
      p1: dcP1 && dcP1.id && dcP1.name ? { id: dcP1.id, name: dcP1.name } : null,
      p2: dcP2 && dcP2.id && dcP2.name ? { id: dcP2.id, name: dcP2.name } : null,
      coordinateSystem: 'equirectangular-meters',
      units: 'meters',
      note:
        'Straight-line Euclidean distance between projected location coordinates ' +
        '(equirectangular metres around the scenario centroid). This is not road distance.',
    };

    benchmarks.push({
      algorithmName: 'divide-and-conquer-closest-pair',
      baselineName: 'brute-force-closest-pair',
      configuration: {
        locationCount: pointRecords.length,
        projection: 'equirectangular-meters',
        units: 'meters',
      },
      resultSummary: {
        metric: 'closest straight-line projected distance (metres)',
        divideAndConquerDistanceMeters: round(dc.distance, 6),
        bruteForceDistanceMeters: round(bf.minDistance, 6),
        distancesAgree:
          Math.abs(dc.distance - bf.minDistance) <= 1e-9 * Math.max(1, bf.minDistance),
        p1: dcP1 ? { id: dcP1.id ?? null, name: dcP1.name ?? null } : null,
        p2: dcP2 ? { id: dcP2.id ?? null, name: dcP2.name ?? null } : null,
        bruteForceComparisons: bf.comparisons,
        divideAndConquerRuntimeMs: round(dcRuntimeMs, 3),
        bruteForceRuntimeMs: round(bfRuntimeMs, 3),
      },
      runtimeMs: round(dcRuntimeMs, 3),
      trialNumber: 1,
    });
  } else {
    addWarning(warnings, {
      code: 'closest-pair-unavailable',
      message: 'Fewer than two projected locations are available, so no closest pair was computed.',
    });
  }

  if (acoVehicleBenchmarks.length > 0) {
    benchmarks.push({
      algorithmName: 'aco',
      baselineName: 'nearest-neighbor',
      configuration: {
        metric: 'total A* road cost (km)',
        seed: runSeed,
        numTrials: resolvedConfig.aco.numTrials,
        numAnts: resolvedConfig.aco.numAnts === 0 ? 'auto' : resolvedConfig.aco.numAnts,
        evaporationRate: resolvedConfig.aco.evaporationRate,
        alpha: resolvedConfig.aco.alpha,
        beta: resolvedConfig.aco.beta,
        note: 'ACO is a heuristic; a lower cost than the baseline is measured, not guaranteed.',
      },
      resultSummary: {
        acoTotalCost: round(acoTotalCost, 6),
        nearestNeighborTotalCost: round(nearestNeighborTotalCost, 6),
        acoRuntimeMs: round(acoRuntimeMs, 3),
        nearestNeighborRuntimeMs: round(nearestNeighborRuntimeMs, 3),
        vehicles: acoVehicleBenchmarks,
      },
      runtimeMs: round(acoRuntimeMs, 3),
      trialNumber: resolvedConfig.aco.numTrials,
    });
  }

  // 8. Post-validation: constraints are recalculated, not trusted blindly.
  const seenDonations = new Set<string>();
  for (const allocation of allocations) {
    if (allocation.totalWeightUnits > allocation.capacityUnits) {
      errors.push(
        `Allocation for vehicle ${allocation.vehicleId} exceeds capacity ` +
          `(${allocation.totalWeightUnits} > ${allocation.capacityUnits}).`,
      );
    }
    for (const donationId of allocation.donationIds) {
      if (seenDonations.has(donationId)) {
        errors.push(`Package ${donationId} was assigned more than once.`);
      }
      seenDonations.add(donationId);
    }
  }

  for (const route of routes) {
    const legTotal = route.legs.reduce((sum, leg) => sum + leg.cost, 0);
    if (Math.abs(legTotal - route.totalCost) > 1e-6) {
      errors.push(
        `Route for vehicle ${route.vehicleId} has an inconsistent total ` +
          `(${route.totalCost} vs legs ${round(legTotal, 6)}).`,
      );
    }
    for (const leg of route.legs) {
      if (!Number.isFinite(leg.cost) || leg.cost < 0) {
        errors.push(`Route for vehicle ${route.vehicleId} contains an invalid leg cost.`);
      }
    }
  }

  // 11. Actual metrics.
  const allocatedValue = allocations.reduce((sum, allocation) => sum + allocation.totalValue, 0);
  const allocatedWeight = allocations.reduce(
    (sum, allocation) => sum + allocation.totalWeightUnits,
    0,
  );
  const totalCapacity = usableVehicles.reduce((sum, vehicle) => sum + vehicle.capacityUnits, 0);
  const totalRoadCost = routes.reduce((sum, route) => sum + route.totalCost, 0);
  const requiredRoutes = routes.filter((route) => route.status !== 'not_required');

  const metrics: Metrics = {
    allocatedPackageValue: allocatedValue,
    allocatedPackageWeightUnits: allocatedWeight,
    unallocatedPackageCount: unallocated.length,
    vehicleCapacityUtilization:
      totalCapacity > 0 ? round((allocatedWeight / totalCapacity) * 100, 2) : 0,
    totalRoadCost: round(totalRoadCost, 6),
    totalRoadCostUnit: roadUnit,
    reachablePairCount,
    unreachablePairCount: analyzedKeys.size - reachablePairCount,
    routeCount: requiredRoutes.length,
    partialRouteCount: routes.filter((route) => route.status === 'partial').length,
    runtimeMs: round(performance.now() - startedAt, 1),
  };

  const unreachable = [...unreachableByKey.values()];

  let status: OptimizationResult['status'];
  if (errors.length > 0) {
    status = 'failed';
  } else {
    const lostForCapacity = unallocated.some((entry) => CAPACITY_REASONS.has(entry.reason));
    const routeIssue = routes.some(
      (route) => route.status === 'partial' || route.status === 'infeasible',
    );
    status = lostForCapacity || routeIssue ? 'partial' : 'succeeded';
  }

  const result: OptimizationResult = {
    status,
    metrics,
    allocations,
    unallocated,
    routes,
    unreachable,
    closestPair,
    warnings,
    errors,
    algorithmConfig: resolvedConfig,
    inputCounts: {
      locations: snapshot.locations.length,
      roads: snapshot.roads.length,
      availableRoads: snapshot.roads.filter((road) => road.isAvailable).length,
      donations: snapshot.donations.length,
      eligibleDonations: ruleEligibleCount,
      vehicles: snapshot.vehicles.length,
      availableVehicles: usableVehicles.length,
    },
  };

  // Benchmark runtime fields are measured, never asserted.
  return { result, benchmarks };
}

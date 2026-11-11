/**
 * Ant Colony Optimization (ACO) for multi-stop route ordering.
 *
 * Contract (AGENTS.md): optimizeRouteWithACO(start, jobs, getCost, config)
 * returns order, legs, cost, feasibility and unreachable jobs.
 *
 * Model
 * -----
 * Each job is an atomic pickup -> delivery pair. An ant walks from the depot,
 * repeatedly choosing an unvisited job; moving to job j from the current
 * delivery point costs `jobCost(current, j)` (reach pickup + pickup -> delivery).
 * This preserves pickup-before-delivery precedence by construction.
 *
 * Pheromone
 * ---------
 * tau[row][j] holds the pheromone for choosing job j from the previous job row
 * (row `m` is the depot). After every trial the pheromone evaporates and each
 * selected ant deposits Q / tourCost. Parameters and the seed are recorded so a
 * run is reproducible. The result is a heuristic, never a proven global optimum.
 *
 * Unreachable pairs
 * -----------------
 * A job that cannot be reached from the depot at all is reported in
 * `unreachableJobs` and excluded from the search. If an ant can no longer reach
 * any remaining job, it stops; the best tour then covers fewer jobs and those
 * jobs are also reported as unreachable rather than silently dropped.
 */

import { nearestNeighborRoute } from './nearest-neighbor';
import {
  EPSILON,
  evaluateOrder,
  isJobFeasibleFromDepot,
  jobCost,
  type CostLookup,
  type RouteJob,
  type RouteLeg,
  type RouteOrderResult,
} from './lib/route';
import { createRng, weightedPick } from './lib/rng';

export interface ACORouteStop {
  /** Unique stop identifier (could be location_id or node id) */
  id: string | number;
  /** Coordinate or location for cost computation */
  locationId: string | number;
  /** Stop type: 'start', 'pickup', 'delivery', or 'other' */
  stopType?: string;
  /** Optional: related donation/recipient id */
  relatedId?: string | number;
  /** Optional: coordinate x for distance-based heuristics */
  x?: number;
  /** Optional: coordinate y for distance-based heuristics */
  y?: number;
}

export interface ACOConfig {
  numAnts: number;
  numTrials: number;
  evaporationRate: number;
  alpha: number;
  beta: number;
  Q: number;
  seed: number;
  useBestAnt: boolean;
}

/** ACO parameter defaults scaled to the stop count, with optional overrides. */
export function createDefaultACOConfig(n: number, overrides?: Partial<ACOConfig>): ACOConfig {
  return {
    numAnts: Math.max(1, Math.ceil(Math.sqrt(Math.max(1, n)))),
    numTrials: 20,
    evaporationRate: 0.5,
    alpha: 1,
    beta: 2,
    Q: 1,
    seed: -1,
    useBestAnt: true,
    ...overrides,
  };
}

/** Validate ACO configuration parameters. */
export function validateACOConfig(config: Partial<ACOConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.numAnts !== undefined && config.numAnts < 1) {
    errors.push('numAnts must be >= 1');
  }
  if (config.numTrials !== undefined && config.numTrials < 1) {
    errors.push('numTrials must be >= 1');
  }
  if (
    config.evaporationRate !== undefined &&
    (config.evaporationRate <= 0 || config.evaporationRate >= 1)
  ) {
    errors.push('evaporationRate must be in (0, 1)');
  }
  if (config.alpha !== undefined && config.alpha < 0) {
    errors.push('alpha must be >= 0');
  }
  if (config.beta !== undefined && config.beta < 0) {
    errors.push('beta must be >= 0');
  }
  if (config.Q !== undefined && config.Q <= 0) {
    errors.push('Q must be > 0');
  }
  if (config.seed !== undefined && config.seed < -1) {
    errors.push('seed must be >= -1 (use -1 for a fresh random seed)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Run Ant Colony Optimization for route ordering.
 *
 * @param startLocationId depot the route starts from
 * @param jobs atomic pickup -> delivery jobs
 * @param getCost road cost between two locations (Infinity when unreachable)
 * @param config ACO parameters; `seed = -1` draws a fresh seed
 */
export function optimizeRouteWithACO(
  startLocationId: string,
  jobs: RouteJob[],
  getCost: CostLookup,
  config: ACOConfig,
): RouteOrderResult {
  const validation = validateACOConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid ACO configuration: ${validation.errors.join('; ')}`);
  }

  const jobsById = new Map(jobs.map((job) => [job.id, job]));

  const feasible: RouteJob[] = [];
  const unreachableJobs: RouteOrderResult['unreachableJobs'] = [];

  for (const job of jobs) {
    if (isJobFeasibleFromDepot(startLocationId, job, getCost)) {
      feasible.push(job);
    } else {
      unreachableJobs.push({
        jobId: job.id,
        fromLocationId: startLocationId,
        toLocationId: job.pickupLocationId,
      });
    }
  }

  const seed = config.seed >= 0 ? config.seed : (Date.now() % 2_147_483_647);
  const rng = createRng(seed);
  const meta = { trials: config.numTrials, seed };

  if (feasible.length === 0) {
    return {
      order: [],
      legs: [],
      totalCost: 0,
      feasible: false,
      unreachableJobs,
      trials: config.numTrials,
      seed,
    };
  }

  const m = feasible.length;
  const depotRow = m;

  /** Cost of moving from a previous job (or the depot when index < 0) to job j. */
  const costTo = (fromIndex: number, jobIndex: number): number => {
    const from = fromIndex < 0 ? startLocationId : feasible[fromIndex].deliveryLocationId;
    return jobCost(from, feasible[jobIndex], getCost);
  };

  const pheromone: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(m).fill(1),
  );
  const rowOf = (index: number) => (index < 0 ? depotRow : index);

  let bestOrder: number[] = [];
  let bestCost = Infinity;
  let bestCovered = -1;
  let totalAnts = 0;

  for (let trial = 0; trial < config.numTrials; trial++) {
    const tours: Array<{ order: number[]; cost: number }> = [];

    for (let ant = 0; ant < config.numAnts; ant++) {
      totalAnts++;

      const unvisited = new Set<number>(feasible.map((_, index) => index));
      const order: number[] = [];
      let current = -1;
      let cost = 0;

      while (unvisited.size > 0) {
        const candidates: number[] = [];
        const weights: number[] = [];

        for (const index of unvisited) {
          const step = costTo(current, index);
          if (!Number.isFinite(step)) continue;
          candidates.push(index);
          const pheromoneWeight = Math.pow(pheromone[rowOf(current)][index], config.alpha);
          const distanceWeight = Math.pow(1 / Math.max(step, EPSILON), config.beta);
          weights.push(Math.max(pheromoneWeight * distanceWeight, EPSILON));
        }

        if (candidates.length === 0) break;

        const pick = weightedPick(weights, rng);
        if (pick < 0) break;

        const chosen = candidates[pick];
        order.push(chosen);
        cost += costTo(current, chosen);
        current = chosen;
        unvisited.delete(chosen);
      }

      tours.push({ order, cost });

      if (
        order.length > bestCovered ||
        (order.length === bestCovered && cost < bestCost - EPSILON)
      ) {
        bestCovered = order.length;
        bestCost = cost;
        bestOrder = order;
      }
    }

    for (const pheromoneRow of pheromone) {
      for (let index = 0; index < m; index++) {
        pheromoneRow[index] *= 1 - config.evaporationRate;
      }
    }

    const depositors = config.useBestAnt
      ? [tours.reduce((best, tour) => (tour.cost < best.cost ? tour : best), tours[0])]
      : tours;

    for (const tour of depositors) {
      if (tour.order.length === 0) continue;
      const deposit = config.Q / Math.max(tour.cost, EPSILON);
      let previous = -1;
      for (const index of tour.order) {
        pheromone[rowOf(previous)][index] += deposit;
        previous = index;
      }
    }
  }

  const orderIds = bestOrder.map((index) => feasible[index].id);
  const evaluated = evaluateOrder(startLocationId, orderIds, jobsById, getCost, meta);

  const missing = feasible.filter((job) => !orderIds.includes(job.id));

  return {
    order: evaluated.order,
    legs: evaluated.legs as RouteLeg[],
    totalCost: evaluated.totalCost,
    feasible: evaluated.feasible && missing.length === 0,
    unreachableJobs: [
      ...unreachableJobs,
      ...evaluated.unreachableJobs,
      ...missing.map((job) => ({
        jobId: job.id,
        fromLocationId: startLocationId,
        toLocationId: job.pickupLocationId,
      })),
    ],
    trials: config.numTrials,
    seed,
    // Diagnostics kept on the object but outside the shared contract shape.
    ...({
      antsPerTrial: config.numAnts,
      totalAnts,
      coveredJobs: orderIds.length,
      jobCount: feasible.length,
      pheromoneRowCount: pheromone.length,
    } as Record<string, unknown>),
  } as RouteOrderResult;
}

/** Nearest-neighbour baseline on the same job model and cost source (FR-32). */
export { nearestNeighborRoute };

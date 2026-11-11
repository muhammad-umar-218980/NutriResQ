/** Shared route-order types for ACO and its nearest-neighbour baseline (FR-27 to FR-33). */

export interface RouteJob {
  /** Donation id. */
  id: string;
  pickupLocationId: string;
  deliveryLocationId: string;
}

export interface RouteLeg {
  fromLocationId: string;
  toLocationId: string;
  cost: number;
}

export type CostLookup = (fromLocationId: string, toLocationId: string) => number;

export interface RouteOrderResult {
  order: string[];
  legs: RouteLeg[];
  totalCost: number;
  feasible: boolean;
  unreachableJobs: Array<{ jobId: string; fromLocationId: string; toLocationId: string }>;
  trials: number;
  seed: number;
}

const EPSILON = 1e-9;

/** Evaluate a fixed job order, preserving pickup-before-delivery precedence. */
export function evaluateOrder(
  startLocationId: string,
  order: string[],
  jobsById: Map<string, RouteJob>,
  getCost: CostLookup,
  meta: { trials: number; seed: number },
): RouteOrderResult {
  const legs: RouteLeg[] = [];
  const unreachableJobs: RouteOrderResult['unreachableJobs'] = [];
  let current = startLocationId;
  let totalCost = 0;

  for (const jobId of order) {
    const job = jobsById.get(jobId);
    if (!job) continue;
    const toPickup = getCost(current, job.pickupLocationId);
    const toDelivery = getCost(job.pickupLocationId, job.deliveryLocationId);
    if (!Number.isFinite(toPickup) || !Number.isFinite(toDelivery)) {
      unreachableJobs.push({
        jobId,
        fromLocationId: Number.isFinite(toPickup) ? job.pickupLocationId : current,
        toLocationId: Number.isFinite(toPickup) ? job.deliveryLocationId : job.pickupLocationId,
      });
      continue;
    }
    legs.push({ fromLocationId: current, toLocationId: job.pickupLocationId, cost: toPickup });
    legs.push({ fromLocationId: job.pickupLocationId, toLocationId: job.deliveryLocationId, cost: toDelivery });
    totalCost += toPickup + toDelivery;
    current = job.deliveryLocationId;
  }

  return {
    order,
    legs,
    totalCost,
    feasible: unreachableJobs.length === 0,
    unreachableJobs,
    trials: meta.trials,
    seed: meta.seed,
  };
}

/** Atomic job cost: reaching its pickup plus pickup -> delivery. */
export function jobCost(currentLocationId: string, job: RouteJob, getCost: CostLookup): number {
  const toPickup = getCost(currentLocationId, job.pickupLocationId);
  if (!Number.isFinite(toPickup)) return Infinity;
  const toDelivery = getCost(job.pickupLocationId, job.deliveryLocationId);
  if (!Number.isFinite(toDelivery)) return Infinity;
  return toPickup + toDelivery;
}

export function isJobFeasibleFromDepot(
  startLocationId: string,
  job: RouteJob,
  getCost: CostLookup,
): boolean {
  return (
    Number.isFinite(getCost(startLocationId, job.pickupLocationId)) &&
    Number.isFinite(getCost(job.pickupLocationId, job.deliveryLocationId))
  );
}

export { EPSILON };

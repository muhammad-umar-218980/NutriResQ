/**
 * Nearest-neighbour route baseline (FR-32).
 * Same job model and cost source as ACO so comparisons are like-for-like.
 */

import {
  CostLookup,
  RouteJob,
  RouteOrderResult,
  evaluateOrder,
  isJobFeasibleFromDepot,
  jobCost,
} from './lib/route';

export function nearestNeighborRoute(
  startLocationId: string,
  jobs: RouteJob[],
  getCost: CostLookup,
  meta: { seed?: number } = {},
): RouteOrderResult {
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const feasible: RouteJob[] = [];
  const unreachableJobs: RouteOrderResult['unreachableJobs'] = [];

  for (const job of jobs) {
    if (isJobFeasibleFromDepot(startLocationId, job, getCost)) feasible.push(job);
    else {
      unreachableJobs.push({
        jobId: job.id,
        fromLocationId: startLocationId,
        toLocationId: job.pickupLocationId,
      });
    }
  }

  const order: string[] = [];
  const remaining = new Set(feasible.map((job) => job.id));
  let current = startLocationId;

  while (remaining.size > 0) {
    let bestId: string | null = null;
    let bestCost = Infinity;

    for (const id of remaining) {
      const job = jobsById.get(id)!;
      const cost = jobCost(current, job, getCost);
      if (!Number.isFinite(cost)) continue;
      if (cost < bestCost || (cost === bestCost && bestId !== null && id < bestId)) {
        bestCost = cost;
        bestId = id;
      }
    }

    if (bestId === null) break;
    order.push(bestId);
    remaining.delete(bestId);
    current = jobsById.get(bestId)!.deliveryLocationId;
  }

  for (const id of remaining) {
    const job = jobsById.get(id)!;
    unreachableJobs.push({ jobId: id, fromLocationId: current, toLocationId: job.pickupLocationId });
  }

  const result = evaluateOrder(startLocationId, order, jobsById, getCost, {
    trials: 1,
    seed: meta.seed ?? -1,
  });
  return {
    ...result,
    unreachableJobs: [...unreachableJobs, ...result.unreachableJobs],
    feasible: unreachableJobs.length === 0 && result.feasible,
  };
}

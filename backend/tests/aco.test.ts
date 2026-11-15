import { describe, expect, it } from 'vitest';

import { optimizeRouteWithACO, createDefaultACOConfig } from '../src/algorithms/aco';
import { aStarSearch } from '../src/algorithms/astar';
import { buildHeuristic, buildRoadGraph, projectLocations } from '../src/algorithms/lib/graph';
import type { RouteJob } from '../src/algorithms/lib/route';
import { evaluateOrder } from '../src/algorithms/lib/route';
import { nearestNeighborRoute } from '../src/algorithms/nearest-neighbor';
import { buildSeedSnapshot, seedLocationId } from './helpers/seed-snapshot';

const NODES = ['D', 'P1', 'P2', 'P3', 'R1', 'R2', 'R3'];
const NODE_INDEX = new Map(NODES.map((node, index) => [node, index]));

/** Deterministic, asymmetric-free cost matrix over the synthetic nodes. */
function syntheticCost(from: string, to: string): number {
  if (from === to) return 0;
  const a = NODE_INDEX.get(from);
  const b = NODE_INDEX.get(to);
  if (a === undefined || b === undefined) return Infinity;
  return 1 + Math.abs(a - b);
}

const JOBS: RouteJob[] = [
  { id: 'j1', pickupLocationId: 'P1', deliveryLocationId: 'R1' },
  { id: 'j2', pickupLocationId: 'P2', deliveryLocationId: 'R2' },
  { id: 'j3', pickupLocationId: 'P3', deliveryLocationId: 'R3' },
];

describe('ant colony route ordering', () => {
  it('is deterministic for a fixed seed', () => {
    const config = createDefaultACOConfig(JOBS.length, { seed: 1234, numTrials: 5 });

    const first = optimizeRouteWithACO('D', JOBS, syntheticCost, config);
    const second = optimizeRouteWithACO('D', JOBS, syntheticCost, config);

    expect(first.order).toEqual(second.order);
    expect(first.totalCost).toBe(second.totalCost);
    expect(first.trials).toBe(5);
    expect(first.seed).toBe(1234);
  });

  it('covers every job and keeps pickup immediately before delivery', () => {
    const config = createDefaultACOConfig(JOBS.length, { seed: 7, numTrials: 3 });
    const result = optimizeRouteWithACO('D', JOBS, syntheticCost, config);

    expect(result.feasible).toBe(true);
    expect(result.unreachableJobs).toEqual([]);
    expect(result.order).toHaveLength(JOBS.length);

    const jobsById = new Map(JOBS.map((job) => [job.id, job]));
    expect(result.legs).toHaveLength(JOBS.length * 2);

    for (let index = 0; index < result.order.length; index++) {
      const job = jobsById.get(result.order[index])!;
      const intoPickup = result.legs[index * 2];
      const pickupToDelivery = result.legs[index * 2 + 1];

      expect(intoPickup.toLocationId).toBe(job.pickupLocationId);
      expect(pickupToDelivery.fromLocationId).toBe(job.pickupLocationId);
      expect(pickupToDelivery.toLocationId).toBe(job.deliveryLocationId);
    }

    const summed = result.legs.reduce((sum, leg) => sum + leg.cost, 0);
    expect(summed).toBeCloseTo(result.totalCost, 9);
  });

  it('surfaces jobs it cannot connect instead of dropping them silently', () => {
    const jobs: RouteJob[] = [
      ...JOBS,
      { id: 'unreachable', pickupLocationId: 'P1', deliveryLocationId: 'X' },
    ];

    const config = createDefaultACOConfig(jobs.length, { seed: 3, numTrials: 2 });
    const result = optimizeRouteWithACO('D', jobs, syntheticCost, config);

    expect(result.unreachableJobs).toHaveLength(1);
    expect(result.unreachableJobs[0].jobId).toBe('unreachable');
    expect(result.order).not.toContain('unreachable');
    // `feasible` describes the emitted route; excluded jobs are listed separately.
    expect(result.order).toHaveLength(JOBS.length);
  });

  it('rejects invalid configuration instead of guessing', () => {
    expect(() =>
      optimizeRouteWithACO('D', JOBS, syntheticCost, {
        ...createDefaultACOConfig(JOBS.length),
        numTrials: 0,
      }),
    ).toThrow(/Invalid ACO configuration/);
  });

  it('scales the default ant count to the stop count', () => {
    expect(createDefaultACOConfig(1).numAnts).toBe(1);
    expect(createDefaultACOConfig(9).numAnts).toBe(3);
    expect(createDefaultACOConfig(16).numAnts).toBe(4);
  });
});

describe('ACO versus nearest neighbour on real seed routes', () => {
  const snapshot = buildSeedSnapshot();
  const graph = buildRoadGraph(snapshot.roads);
  const coords = projectLocations(snapshot.locations);

  const roadCost = (from: string, to: string): number => {
    if (from === to) return 0;
    const result = aStarSearch(graph, from, to, buildHeuristic('km', coords, to));
    return result.reached ? result.totalCost : Infinity;
  };

  const donation = (packageName: string) => {
    const found = snapshot.donations.find((entry) => entry.packageName === packageName);
    if (!found) throw new Error(`Seed donation "${packageName}" is missing.`);
    return found;
  };

  const jobs: RouteJob[] = ['Bread crate', 'Cooked meals', 'Canned goods'].map((name) => {
    const entry = donation(name);
    return {
      id: entry.id,
      pickupLocationId: entry.donorLocationId!,
      deliveryLocationId: entry.recipientLocationId!,
    };
  });

  it('covers the same jobs as nearest neighbour with finite measured costs', () => {
    const depot = seedLocationId(1);
    const config = createDefaultACOConfig(jobs.length, { seed: 2026, numTrials: 10 });

    const aco = optimizeRouteWithACO(depot, jobs, roadCost, config);
    const nn = nearestNeighborRoute(depot, jobs, roadCost, { seed: 2026 });

    expect(aco.order).toHaveLength(jobs.length);
    expect(nn.order).toHaveLength(jobs.length);
    expect(Number.isFinite(aco.totalCost)).toBe(true);
    expect(Number.isFinite(nn.totalCost)).toBe(true);

    // Reported for the evaluation section; ACO is a heuristic, so this is not asserted.
    console.log(
      `[aco-vs-nn] ACO=${aco.totalCost.toFixed(3)} km, NN=${nn.totalCost.toFixed(3)} km, ` +
        `trials=${aco.trials}, seed=${aco.seed}`,
    );
  });

  it('never claims a cost below the exhaustive optimal order for this small instance', () => {
    const depot = seedLocationId(1);
    const config = createDefaultACOConfig(jobs.length, { seed: 2026, numTrials: 10 });
    const aco = optimizeRouteWithACO(depot, jobs, roadCost, config);
    const jobsById = new Map(jobs.map((job) => [job.id, job]));

    const permutations = (ids: string[]): string[][] =>
      ids.length <= 1
        ? [ids]
        : ids.flatMap((id, index) =>
            permutations(ids.filter((_, other) => other !== index)).map((rest) => [id, ...rest]),
          );

    const optimal = Math.min(
      ...permutations(jobs.map((job) => job.id)).map(
        (order) =>
          evaluateOrder(depot, order, jobsById, roadCost, { trials: 1, seed: 0 }).totalCost,
      ),
    );

    expect(aco.totalCost).toBeGreaterThanOrEqual(optimal - 1e-9);

    // Reported for the evaluation section; ACO is a heuristic, so the gap is measured, not asserted.
    console.log(
      `[aco-optimality] ACO=${aco.totalCost.toFixed(3)} km, exhaustive=${optimal.toFixed(3)} km, ` +
        `gap=${(((aco.totalCost - optimal) / optimal) * 100).toFixed(2)}%`,
    );
  });
});

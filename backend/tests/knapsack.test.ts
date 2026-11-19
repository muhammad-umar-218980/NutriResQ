import { describe, expect, it } from 'vitest';

import {
  greedyKnapsackAllocation,
  type GreedyPackage,
  type GreedyVehicle,
} from '../src/algorithms/greedy-knapsack';
import { createRng } from '../src/algorithms/lib/rng';
import {
  exhaustiveBestValue as productionExhaustiveBestValue,
  verifyOptimalitySmall,
} from '../src/algorithms/lib/optimality';
import {
  solveMultipleKnapsack,
  type MultipleKnapsackItem,
} from '../src/algorithms/multiple-knapsack-dp';

/**
 * Independent exhaustive solver over the same multiple-knapsack model:
 * every package is skipped or placed on one vehicle with spare capacity.
 * Only small instances are used, so the exponential enumeration stays cheap.
 */
function exhaustiveBestValue(items: MultipleKnapsackItem[], capacities: number[]): number {
  const usage = capacities.map(() => 0);
  let best = 0;

  const visit = (index: number, value: number): void => {
    if (index === items.length) {
      if (value > best) best = value;
      return;
    }

    // Skip the package.
    visit(index + 1, value);

    const item = items[index];
    if (!Number.isInteger(item.weightUnits) || item.weightUnits <= 0) return;
    if (!Number.isFinite(item.value) || item.value < 0) return;

    for (let vehicle = 0; vehicle < capacities.length; vehicle++) {
      if (usage[vehicle] + item.weightUnits <= capacities[vehicle]) {
        usage[vehicle] += item.weightUnits;
        visit(index + 1, value + item.value);
        usage[vehicle] -= item.weightUnits;
      }
    }
  };

  visit(0, 0);
  return best;
}

function asGreedy(items: MultipleKnapsackItem[], capacities: number[]) {
  const packages: GreedyPackage[] = items.map((item, index) => ({
    id: index,
    weight: item.weightUnits,
    value: item.value,
    valueToWeightRatio: item.weightUnits > 0 ? item.value / item.weightUnits : 0,
  }));
  const vehicles: GreedyVehicle[] = capacities.map((capacity, index) => ({
    id: index,
    capacity,
    maxCapacity: capacity,
    assignedPackages: [],
    totalWeight: 0,
    totalValue: 0,
  }));
  return { packages, vehicles };
}

describe('multiple-knapsack DP', () => {
  it('matches an independent exhaustive search on 50 random small instances', () => {
    const rng = createRng(20261115);

    for (let instance = 0; instance < 50; instance++) {
      const vehicleCount = 1 + Math.floor(rng() * 3);
      const capacities = Array.from({ length: vehicleCount }, () => 4 + Math.floor(rng() * 9));
      const itemCount = 1 + Math.floor(rng() * 8);
      const items: MultipleKnapsackItem[] = Array.from({ length: itemCount }, (_, index) => ({
        id: `item-${index}`,
        weightUnits: 1 + Math.floor(rng() * 10),
        value: 1 + Math.floor(rng() * 30),
      }));

      const dp = solveMultipleKnapsack(items, capacities, { maxStates: 250_000 });
      const exhaustive = exhaustiveBestValue(items, capacities);

      expect(dp.totalValue, `instance ${instance} differs from exhaustive search`).toBeCloseTo(
        exhaustive,
        9,
      );
    }
  });

  it('respects capacity, never duplicates a package and reports consistent totals', () => {
    const rng = createRng(7);
    const capacities = [12, 9, 15];

    for (let instance = 0; instance < 30; instance++) {
      const items: MultipleKnapsackItem[] = Array.from(
        { length: 10 + Math.floor(rng() * 10) },
        (_, index) => ({
          id: `pkg-${index}`,
          weightUnits: 1 + Math.floor(rng() * 8),
          value: 1 + Math.floor(rng() * 20),
        }),
      );

      const dp = solveMultipleKnapsack(items, capacities, { maxStates: 250_000 });
      const seen = new Set<number>();
      let summedWeight = 0;
      let summedValue = 0;

      for (const assignment of dp.assignments) {
        const weight = assignment.itemIndexes.reduce(
          (sum, itemIndex) => sum + items[itemIndex].weightUnits,
          0,
        );
        expect(weight).toBeLessThanOrEqual(capacities[assignment.vehicleIndex]);
        expect(assignment.totalWeightUnits).toBe(weight);
        summedWeight += weight;

        for (const itemIndex of assignment.itemIndexes) {
          expect(seen.has(itemIndex), `package ${itemIndex} assigned twice`).toBe(false);
          seen.add(itemIndex);
          summedValue += items[itemIndex].value;
        }
      }

      expect(summedWeight).toBe(dp.totalWeightUnits);
      expect(summedValue).toBeCloseTo(dp.totalValue, 9);
    }
  });

  it('never beats the exact DP with the greedy baseline', () => {
    const rng = createRng(99);

    for (let instance = 0; instance < 30; instance++) {
      const capacities = [10 + Math.floor(rng() * 10), 10 + Math.floor(rng() * 10)];
      const items: MultipleKnapsackItem[] = Array.from(
        { length: 12 + Math.floor(rng() * 8) },
        (_, index) => ({
          id: `pkg-${index}`,
          weightUnits: 1 + Math.floor(rng() * 9),
          value: 1 + Math.floor(rng() * 25),
        }),
      );

      const dp = solveMultipleKnapsack(items, capacities, { maxStates: 250_000 });
      const { packages, vehicles } = asGreedy(items, capacities);
      const greedy = greedyKnapsackAllocation(packages, vehicles);

      expect(greedy.metrics.totalValueAllocated).toBeLessThanOrEqual(dp.totalValue + 1e-9);
    }
  });

  it('excludes oversized packages with an explicit reason', () => {
    const dp = solveMultipleKnapsack(
      [
        { id: 'small', weightUnits: 10, value: 50 },
        { id: 'huge', weightUnits: 80, value: 500 },
      ],
      [60, 45, 50],
      { maxStates: 250_000 },
    );

    const oversized = dp.unallocated.find((entry) => entry.reason === 'oversized');
    expect(oversized).toBeDefined();
    expect(oversized?.itemIndex).toBe(1);
    expect(dp.totalValue).toBe(50);
  });

  it('reports no_vehicle when no vehicle is supplied', () => {
    const dp = solveMultipleKnapsack([{ weightUnits: 5, value: 10 }], [], { maxStates: 100 });

    expect(dp.assignments).toEqual([]);
    expect(dp.totalValue).toBe(0);
    expect(dp.unallocated[0]?.reason).toBe('no_vehicle');
  });

  it('rejects malformed package weights as invalid', () => {
    const dp = solveMultipleKnapsack(
      [
        { weightUnits: 0, value: 10 },
        { weightUnits: 2.5, value: 10 },
        { weightUnits: 5, value: 10 },
      ],
      [10],
      { maxStates: 100 },
    );

    const invalid = dp.unallocated.filter((entry) => entry.reason === 'invalid');
    expect(invalid.map((entry) => entry.itemIndex)).toEqual([0, 1]);
    expect(dp.totalValue).toBe(10);
  });

  it('returns an empty assignment set for zero items', () => {
    const dp = solveMultipleKnapsack([], [10, 20], { maxStates: 1_000 });

    expect(dp.assignments).toHaveLength(2);
    expect(dp.assignments.every((assignment) => assignment.itemIndexes.length === 0)).toBe(true);
    expect(dp.totalValue).toBe(0);
    expect(dp.totalWeightUnits).toBe(0);
  });

  it('reports the mixed-radix state count', () => {
    const dp = solveMultipleKnapsack([], [60, 45, 50], { maxStates: 250_000 });
    expect(dp.stateCount).toBe(61 * 46 * 51);
    expect(dp.exact).toBe(true);
  });

  it('refuses to run when the state space exceeds maxStates', () => {
    expect(() =>
      solveMultipleKnapsack([], [60, 45, 50], { maxStates: 10_000 }),
    ).toThrow(/maxStates/);
  });
});

describe('exhaustive cross-check used by the Algorithms lab', () => {
  /**
   * Production verifier, including its own exhaustive enumeration. The suite
   * compares it with the independent solver above so a shared bug cannot hide.
   */
  it('agrees with the independent exhaustive solver on random instances', () => {
    const rng = createRng(31337);

    for (let instance = 0; instance < 25; instance++) {
      const capacities = Array.from(
        { length: 1 + Math.floor(rng() * 3) },
        () => 4 + Math.floor(rng() * 9),
      );
      const items: MultipleKnapsackItem[] = Array.from(
        { length: 1 + Math.floor(rng() * 7) },
        (_, index) => ({
          id: `pkg-${index}`,
          weightUnits: 1 + Math.floor(rng() * 7),
          value: 1 + Math.floor(rng() * 20),
        }),
      );

      const check = verifyOptimalitySmall(items, capacities);
      expect(check.attempted, `instance ${instance} was skipped`).toBe(true);
      expect(check.match, `instance ${instance} disagreed with exhaustive`).toBe(true);
      expect(check.dpValue).toBeCloseTo(exhaustiveBestValue(items, capacities), 9);
      expect(check.exhaustiveValue).toBeCloseTo(
        productionExhaustiveBestValue(items, capacities),
        9,
      );
      // Nothing was trimmed: the whole instance fits inside the limit.
      expect(check.reduced).toBe(false);
      expect(check.itemCount).toBe(items.length);
    }
  });

  it('trims to the largest prefix that fits the enumeration limit', () => {
    const items: MultipleKnapsackItem[] = Array.from({ length: 40 }, (_, index) => ({
      id: `pkg-${index}`,
      weightUnits: 1 + (index % 7),
      value: 1 + (index % 13),
    }));

    const check = verifyOptimalitySmall(items, [15, 15, 15], {
      maxEnumerations: 200_000,
    });

    // (3 vehicles + 1) ^ 8 = 65,536; ^ 9 = 262,144 > 200,000.
    expect(check.attempted).toBe(true);
    expect(check.itemCount).toBe(8);
    expect(check.requestedItemCount).toBe(40);
    expect(check.reduced).toBe(true);
    expect(check.enumerationCount).toBe(65_536);
    expect(check.enumerationCount).toBeLessThanOrEqual(check.enumerationLimit);
    expect(check.match).toBe(true);
  });

  it('is deterministic for the same instance', () => {
    const items: MultipleKnapsackItem[] = Array.from({ length: 12 }, (_, index) => ({
      id: `pkg-${index}`,
      weightUnits: 1 + (index % 5),
      value: index + 1,
    }));

    const first = verifyOptimalitySmall(items, [10, 12], { maxEnumerations: 50_000 });
    const second = verifyOptimalitySmall(items, [10, 12], { maxEnumerations: 50_000 });

    expect(first.itemCount).toBe(second.itemCount);
    expect(first.dpValue).toBe(second.dpValue);
    expect(first.exhaustiveValue).toBe(second.exhaustiveValue);
    expect(first.enumerationCount).toBe(second.enumerationCount);
  });

  it('declines rather than guessing when the instance cannot be checked', () => {
    const noVehicles = verifyOptimalitySmall([{ weightUnits: 5, value: 10 }], []);
    expect(noVehicles.attempted).toBe(false);
    expect(noVehicles.match).toBeNull();
    expect(noVehicles.reason).toMatch(/vehicle/i);

    const noItems = verifyOptimalitySmall([], [10, 20]);
    expect(noItems.attempted).toBe(false);
    expect(noItems.reason).toMatch(/package/i);

    const tooLarge = verifyOptimalitySmall([{ weightUnits: 1, value: 1 }], [10], {
      maxEnumerations: 1,
    });
    expect(tooLarge.attempted).toBe(false);
    expect(tooLarge.reason).toMatch(/limit/i);
  });
});

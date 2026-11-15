import { describe, expect, it } from 'vitest';

import {
  defaultVariantName,
  metricDeltas,
  projectedStateCount,
  selectTopUrgencyRecipients,
} from '../src/lib/scenario-math';
import { resolveAlgorithmConfig, runOptimization } from '../src/services/optimization.service';
import type { Metrics, RecipientRecord, ScenarioSnapshot } from '../src/types/domain';
import { buildSeedSnapshot, SEED_RUN_STARTED_AT } from './helpers/seed-snapshot';

function metrics(overrides: Partial<Metrics> = {}): Metrics {
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
    runtimeMs: 0,
    ...overrides,
  };
}

function recipient(name: string, priorityScore: number, demandUnits: number): RecipientRecord {
  return {
    id: name,
    scenarioId: 'scenario',
    locationId: `location-${name}`,
    name,
    recipientType: null,
    demandUnits,
    priorityScore,
    isAvailable: true,
  };
}

describe('exact-DP state-space projection', () => {
  it('counts one state for an empty fleet and prod(capacity + 1) otherwise', () => {
    expect(projectedStateCount([])).toBe(1);
    expect(projectedStateCount([15])).toBe(16);
    expect(projectedStateCount([60, 45, 50])).toBe(61 * 46 * 51);
    expect(projectedStateCount([60, 45, 50])).toBe(143_106);
  });

  it('shows why the seeded 70 kg truck cannot be enabled by default', () => {
    const defaultFleet = projectedStateCount([60, 45, 50]);
    const withTruck = projectedStateCount([60, 45, 50, 70]);

    expect(withTruck).toBe(defaultFleet * 71);
    expect(withTruck).toBeGreaterThan(250_000);
  });

  it('clamps an impossible fleet instead of overflowing silently', () => {
    expect(projectedStateCount([1_000_000_000, 1_000_000_000])).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('treats capacities as whole kilograms', () => {
    expect(projectedStateCount([2.9])).toBe(3);
    expect(projectedStateCount([0])).toBe(1);
  });
});

describe('metric deltas for the comparison view', () => {
  const base = {
    metrics: metrics({
      allocatedPackageValue: 500,
      allocatedPackageWeightUnits: 100,
      unallocatedPackageCount: 4,
      totalRoadCost: 20,
      vehicleCapacityUtilization: 66.67,
      routeCount: 2,
    }),
    packagesAllocated: 10,
    status: 'partial',
  };

  const variant = {
    metrics: metrics({
      allocatedPackageValue: 400,
      allocatedPackageWeightUnits: 80,
      unallocatedPackageCount: 6,
      totalRoadCost: 25,
      vehicleCapacityUtilization: 53.33,
      routeCount: 3,
    }),
    packagesAllocated: 8,
    status: 'partial',
  };

  it('reports absolute and relative change per metric', () => {
    const deltas = metricDeltas(base, variant);
    const weight = deltas.find((entry) => entry.metric === 'allocatedPackageWeightUnits')!;

    expect(weight.base).toBe(100);
    expect(weight.variant).toBe(80);
    expect(weight.delta).toBe(-20);
    expect(weight.deltaPercent).toBeCloseTo(-20, 9);
    expect(weight.lowerIsBetter).toBe(false);
  });

  it('includes packages served, which is derived rather than stored', () => {
    const deltas = metricDeltas(base, variant);
    const packages = deltas.find((entry) => entry.metric === 'packagesAllocated')!;

    expect(packages.base).toBe(10);
    expect(packages.variant).toBe(8);
    expect(packages.delta).toBe(-2);
  });

  it('marks cost, waste and partial routes as lower-is-better', () => {
    const deltas = metricDeltas(base, variant);
    const lower = deltas.filter((entry) => entry.lowerIsBetter).map((entry) => entry.metric);

    expect(lower).toEqual([
      'totalRoadCost',
      'unallocatedPackageCount',
      'partialRouteCount',
      'unreachablePairCount',
      'runtimeMs',
    ]);
  });

  it('never divides by a zero base', () => {
    const zeroBase = { metrics: metrics({ totalRoadCost: 0 }), packagesAllocated: 0, status: 'partial' };
    const deltas = metricDeltas(zeroBase, variant);
    const cost = deltas.find((entry) => entry.metric === 'totalRoadCost')!;

    expect(cost.delta).toBe(25);
    expect(cost.deltaPercent).toBeNull();
  });

  it('treats a failed run with no metrics as zero instead of throwing', () => {
    const deltas = metricDeltas(
      { metrics: null, packagesAllocated: 0, status: 'failed' },
      { metrics: null, packagesAllocated: 0, status: 'failed' },
    );

    expect(deltas.every((entry) => entry.base === 0 && entry.variant === 0)).toBe(true);
  });
});

describe('urgency ranking for the sensitivity experiment', () => {
  const recipients = [
    recipient('Equal priority small', 90, 10),
    recipient('Tallest priority', 95, 5),
    recipient('Equal priority large', 90, 40),
    recipient('Low priority', 40, 100),
  ];

  it('ranks by priority, then demand, then name', () => {
    expect(selectTopUrgencyRecipients(recipients, 3).map((entry) => entry.name)).toEqual([
      'Tallest priority',
      'Equal priority large',
      'Equal priority small',
    ]);
  });

  it('clamps the count to the available recipients', () => {
    expect(selectTopUrgencyRecipients(recipients, 10)).toHaveLength(4);
    expect(selectTopUrgencyRecipients(recipients, 0)).toEqual([]);
  });

  it('does not reorder the caller array', () => {
    const original = recipients.map((entry) => entry.name);
    selectTopUrgencyRecipients(recipients, 4);
    expect(recipients.map((entry) => entry.name)).toEqual(original);
  });
});

describe('variant naming', () => {
  it('keeps the name inside the database limit', () => {
    const name = defaultVariantName('x'.repeat(200));
    expect(name.length).toBeLessThanOrEqual(120);
    expect(defaultVariantName('Base')).toBe('Base — variant');
  });
});

describe('recipient availability in the optimization pipeline', () => {
  const closeRecipientOf = (snapshot: ScenarioSnapshot, packageName: string): ScenarioSnapshot => {
    const donation = snapshot.donations.find((entry) => entry.packageName === packageName);
    if (!donation?.recipientId) throw new Error(`${packageName} has no intended recipient.`);

    return {
      ...snapshot,
      recipients: snapshot.recipients.map((entry) =>
        entry.id === donation.recipientId ? { ...entry, isAvailable: false } : entry,
      ),
    };
  };

  it('excludes packages whose intended recipient is unavailable', () => {
    const snapshot = buildSeedSnapshot();
    const config = resolveAlgorithmConfig({ aco: { seed: 424242, numTrials: 4 } });

    const baseline = runOptimization({ snapshot, config, runStartedAt: SEED_RUN_STARTED_AT });
    const baselineAllocated = new Set(
      baseline.result.allocations.flatMap((allocation) => allocation.donationIds),
    );
    const target = snapshot.donations.find((entry) => entry.packageName === 'Bread crate')!;
    expect(baselineAllocated.has(target.id)).toBe(true);

    const variant = runOptimization({
      snapshot: closeRecipientOf(snapshot, 'Bread crate'),
      config,
      runStartedAt: SEED_RUN_STARTED_AT,
    });

    const excluded = variant.result.unallocated.find((entry) => entry.donationId === target.id);
    expect(excluded?.reason).toBe('not_available');
    expect(excluded?.detail).toMatch(/recipient/i);

    const variantAllocated = new Set(
      variant.result.allocations.flatMap((allocation) => allocation.donationIds),
    );
    expect(variantAllocated.has(target.id)).toBe(false);
  });

  it('keeps every seeded recipient available by default', () => {
    const snapshot = buildSeedSnapshot();
    expect(snapshot.recipients.every((entry) => entry.isAvailable)).toBe(true);
  });
});

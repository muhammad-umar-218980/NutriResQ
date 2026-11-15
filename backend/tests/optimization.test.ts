import { describe, expect, it } from 'vitest';

import { resolveAlgorithmConfig, runOptimization } from '../src/services/optimization.service';
import type { ScenarioSnapshot } from '../src/types/domain';
import { buildSeedSnapshot, SEED_RUN_STARTED_AT } from './helpers/seed-snapshot';

const snapshot = buildSeedSnapshot();
const config = resolveAlgorithmConfig({ aco: { seed: 424242, numTrials: 4 } });
const outcome = runOptimization({ snapshot, config, runStartedAt: SEED_RUN_STARTED_AT });
const { result, benchmarks } = outcome;

const unallocatedReason = (packageName: string): string | undefined =>
  result.unallocated.find((entry) => entry.packageName === packageName)?.reason;

describe('optimization pipeline on the seed scenario', () => {
  it('counts the loaded input correctly', () => {
    expect(result.inputCounts.locations).toBe(28);
    expect(result.inputCounts.roads).toBe(62);
    expect(result.inputCounts.availableRoads).toBe(61);
    expect(result.inputCounts.donations).toBe(24);
    expect(result.inputCounts.vehicles).toBe(5);
    expect(result.inputCounts.availableVehicles).toBe(3);
    expect(result.inputCounts.eligibleDonations).toBe(24 - 4); // expired, ineligible, unavailable, future-dated
  });

  it('finishes as partial because supply exceeds the available fleet capacity', () => {
    expect(result.errors).toEqual([]);
    expect(result.status).toBe('partial');
  });

  it('filters every designed ineligibility case out of the allocation', () => {
    expect(unallocatedReason('Dairy pack (expired)')).toBe('expired');
    expect(unallocatedReason('Ineligible sample')).toBe('ineligible');
    expect(unallocatedReason('Oversized pallet')).toBe('oversized');
    expect(unallocatedReason('Butter tubs')).toBe('not_available');
    expect(unallocatedReason('Future harvest box')).toBe('not_available');

    const allocatedNames = new Set(
      result.allocations.flatMap((allocation) =>
        allocation.donationIds.map(
          (id) => snapshot.donations.find((donation) => donation.id === id)?.packageName,
        ),
      ),
    );

    for (const name of [
      'Dairy pack (expired)',
      'Ineligible sample',
      'Oversized pallet',
      'Butter tubs',
      'Future harvest box',
    ]) {
      expect(allocatedNames.has(name), `${name} should not be allocated`).toBe(false);
    }
  });

  it('respects capacity and never assigns the same package twice', () => {
    for (const allocation of result.allocations) {
      expect(allocation.totalWeightUnits).toBeLessThanOrEqual(allocation.capacityUnits);
      expect(allocation.totalWeightUnits).toBeGreaterThanOrEqual(0);
    }

    const assigned = result.allocations.flatMap((allocation) => allocation.donationIds);
    expect(new Set(assigned).size).toBe(assigned.length);
    expect(assigned.length).toBeGreaterThan(0);
  });

  it('reports metrics that agree with the allocation rows', () => {
    const { metrics } = result;
    const weight = result.allocations.reduce((sum, entry) => sum + entry.totalWeightUnits, 0);
    const value = result.allocations.reduce((sum, entry) => sum + entry.totalValue, 0);
    const capacity = 60 + 45 + 50;

    expect(metrics.allocatedPackageWeightUnits).toBe(weight);
    expect(metrics.allocatedPackageValue).toBeCloseTo(value, 6);
    expect(metrics.vehicleCapacityUtilization).toBeCloseTo((weight / capacity) * 100, 1);
    expect(metrics.unallocatedPackageCount).toBe(result.unallocated.length);
    expect(metrics.totalRoadCostUnit).toBe('km');
    expect(metrics.totalRoadCost).toBeGreaterThan(0);
    expect(weight).toBeLessThanOrEqual(capacity);
  });

  it('reports Isolation Point by name and never routes through the closed road', () => {
    const isolated = result.unreachable.filter(
      (pair) => pair.fromName === 'Isolation Point' || pair.toName === 'Isolation Point',
    );

    expect(isolated.length).toBe(27 * 2);
    expect(result.metrics.unreachablePairCount).toBe(27 * 2);
    expect(result.metrics.reachablePairCount).toBe(27 * 26);
    expect(result.metrics.reachablePairCount + result.metrics.unreachablePairCount).toBe(28 * 27);

    const closedRoad = snapshot.roads.find((road) => !road.isAvailable)!;
    for (const route of result.routes) {
      for (const leg of route.legs) {
        const usesClosed =
          (leg.fromLocationId === closedRoad.fromLocationId &&
            leg.toLocationId === closedRoad.toLocationId) ||
          (leg.fromLocationId === closedRoad.toLocationId &&
            leg.toLocationId === closedRoad.fromLocationId);
        expect(usesClosed).toBe(false);
      }
    }

    expect(
      result.warnings.some(
        (warning) =>
          warning.code === 'location-disconnected' && warning.message.includes('Isolation Point'),
      ),
    ).toBe(true);
  });

  it('builds routes only from allocated donations, one pickup before each delivery', () => {
    const assigned = new Set(result.allocations.flatMap((allocation) => allocation.donationIds));

    for (const route of result.routes) {
      const stopDonations = route.stops
        .filter((stop) => stop.stopType === 'pickup' || stop.stopType === 'delivery')
        .map((stop) => stop.relatedDonationId);
      for (const donationId of stopDonations) {
        expect(donationId).not.toBeNull();
        expect(assigned.has(donationId as string)).toBe(true);
      }

      // Every delivery stop must follow its own pickup stop.
      const seenPickups = new Set<string>();
      for (const stop of route.stops) {
        if (stop.stopType === 'pickup') seenPickups.add(stop.relatedDonationId as string);
        if (stop.stopType === 'delivery') {
          expect(seenPickups.has(stop.relatedDonationId as string)).toBe(true);
        }
      }

      expect(route.legs.length).toBeGreaterThanOrEqual(0);
      expect(route.totalCost).toBeGreaterThanOrEqual(0);
    }
  });

  it('records the DP, closest-pair and ACO comparisons in the benchmark list', () => {
    const dp = benchmarks.find((entry) => entry.algorithmName === 'multiple-knapsack-dp');
    expect(dp).toBeDefined();
    expect(dp?.configuration?.stateCount).toBe(143_106);
    expect(dp?.configuration?.exact).toBe(true);
    expect(Number(dp?.resultSummary?.dpTotalValue)).toBeGreaterThanOrEqual(
      Number(dp?.resultSummary?.greedyTotalValue),
    );

    const closest = benchmarks.find(
      (entry) => entry.algorithmName === 'divide-and-conquer-closest-pair',
    );
    expect(closest).toBeDefined();
    expect(closest?.resultSummary?.distancesAgree).toBe(true);
    expect(Number(closest?.resultSummary?.bruteForceComparisons)).toBe((28 * 27) / 2);

    const aco = benchmarks.find((entry) => entry.algorithmName === 'aco');
    expect(aco).toBeDefined();
    expect(Number(aco?.resultSummary?.acoTotalCost)).toBeGreaterThan(0);
    expect(Number(aco?.resultSummary?.nearestNeighborTotalCost)).toBeGreaterThan(0);
  });

  it('produces a named closest pair from the stored locations', () => {
    expect(result.closestPair).not.toBeNull();
    expect(result.closestPair?.p1?.name).toBeTruthy();
    expect(result.closestPair?.p2?.name).toBeTruthy();
    expect(result.closestPair?.distanceMeters).toBeGreaterThanOrEqual(0);
    expect(result.closestPair?.coordinateSystem).toBe('equirectangular-meters');
  });

  it('is deterministic for a fixed snapshot, config and seed', () => {
    const second = runOptimization({ snapshot, config, runStartedAt: SEED_RUN_STARTED_AT });

    expect(second.result.allocations).toEqual(result.allocations);
    expect(second.result.routes.map((route) => route.totalCost)).toEqual(
      result.routes.map((route) => route.totalCost),
    );
    expect(second.result.unallocated).toEqual(result.unallocated);
    expect(second.result.closestPair).toEqual(result.closestPair);
  }, 60_000);

  it('fails honestly when the exact DP state limit is exceeded', () => {
    const limited = runOptimization({
      snapshot,
      config: resolveAlgorithmConfig({ knapsack: { maxStates: 10 }, aco: { seed: 1, numTrials: 1 } }),
      runStartedAt: SEED_RUN_STARTED_AT,
    });

    expect(limited.result.status).toBe('failed');
    expect(limited.result.errors.join(' ')).toMatch(/maxStates/);
    expect(
      limited.result.unallocated.some((entry) => entry.reason === 'state_limit_exceeded'),
    ).toBe(true);
    expect(limited.result.allocations.every((entry) => entry.donationIds.length === 0)).toBe(true);
  });

  it('fails honestly when a location has non-finite coordinates', () => {
    const broken: ScenarioSnapshot = {
      ...snapshot,
      locations: snapshot.locations.map((location, index) =>
        index === 0 ? { ...location, latitude: Number.NaN } : location,
      ),
    };

    const failed = runOptimization({
      snapshot: broken,
      config,
      runStartedAt: SEED_RUN_STARTED_AT,
    });

    expect(failed.result.status).toBe('failed');
    expect(failed.result.errors.join(' ')).toMatch(/non-finite coordinates/);
    expect(failed.result.metrics.allocatedPackageWeightUnits).toBe(0);
  });
});

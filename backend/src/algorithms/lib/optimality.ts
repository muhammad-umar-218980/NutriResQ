/**
 * Independent exhaustive cross-check for the multiple-knapsack DP.
 *
 * The DP is exact by construction, but "exact" is a claim about the code, not
 * about the maths. This module enumerates every skip/place decision for a small
 * instance and reports whether the DP finds the same objective value. It is
 * used by the Algorithms lab ("DP == exhaustive for this instance") and by the
 * test suite; it is never part of the production allocation path, because the
 * enumeration is exponential.
 */

import {
  solveMultipleKnapsack,
  type MultipleKnapsackItem,
  type MultipleKnapsackResult,
} from '../multiple-knapsack-dp';

export interface OptimalityCheckOptions {
  /** Hard ceiling on enumerated assignments; the prefix is trimmed to fit. */
  maxEnumerations?: number;
  /** Passed through to the DP (default 250,000). */
  maxStates?: number;
}

export interface OptimalityCheck {
  /** False when the instance is too large to enumerate or has nothing to check. */
  attempted: boolean;
  reason: string | null;
  /** Items compared (a deterministic prefix when `reduced` is true). */
  itemCount: number;
  /** Items supplied by the caller. */
  requestedItemCount: number;
  vehicleCount: number;
  /** `(vehicles + 1) ^ itemCount`: assignments the enumeration visits. */
  enumerationCount: number;
  enumerationLimit: number;
  dpValue: number | null;
  exhaustiveValue: number | null;
  match: boolean | null;
  /** True when only the first N items were compared. */
  reduced: boolean;
  dp: MultipleKnapsackResult | null;
}

const DEFAULT_MAX_ENUMERATIONS = 200_000;
const DEFAULT_MAX_STATES = 250_000;
const EPSILON = 1e-9;

/**
 * Enumerate every assignment of `items` to the given vehicle capacities (or to
 * the skip pile) and return the best achievable objective value.
 */
export function exhaustiveBestValue(
  items: MultipleKnapsackItem[],
  capacities: number[],
): number {
  const usage = capacities.map(() => 0);
  let best = 0;

  const visit = (index: number, value: number): void => {
    if (index === items.length) {
      if (value > best) best = value;
      return;
    }

    const item = items[index];

    // The DP never allocates a non-positive weight; skip it here too.
    if (!Number.isInteger(item.weightUnits) || item.weightUnits <= 0) {
      visit(index + 1, value);
      return;
    }

    // Skip the package.
    visit(index + 1, value);

    for (let vehicleIndex = 0; vehicleIndex < capacities.length; vehicleIndex++) {
      const capacity = capacities[vehicleIndex];
      if (usage[vehicleIndex] + item.weightUnits > capacity) continue;
      usage[vehicleIndex] += item.weightUnits;
      visit(index + 1, value + item.value);
      usage[vehicleIndex] -= item.weightUnits;
    }
  };

  visit(0, 0);
  return best;
}

/**
 * Compare the DP with exhaustive enumeration on the largest deterministic
 * prefix of `items` that fits inside the enumeration limit.
 *
 * A prefix (rather than a random subset) keeps the check reproducible: the same
 * scenario always reports the same result.
 */
export function verifyOptimalitySmall(
  items: MultipleKnapsackItem[],
  capacities: number[],
  options: OptimalityCheckOptions = {},
): OptimalityCheck {
  const limit = Math.max(1, Math.floor(options.maxEnumerations ?? DEFAULT_MAX_ENUMERATIONS));
  const maxStates = options.maxStates ?? DEFAULT_MAX_STATES;
  const base = capacities.length + 1;

  const skipped = (reason: string): OptimalityCheck => ({
    attempted: false,
    reason,
    itemCount: 0,
    requestedItemCount: items.length,
    vehicleCount: capacities.length,
    enumerationCount: 0,
    enumerationLimit: limit,
    dpValue: null,
    exhaustiveValue: null,
    match: null,
    reduced: false,
    dp: null,
  });

  if (capacities.length === 0) {
    return skipped('No usable vehicle is available, so there is nothing to allocate.');
  }
  if (items.length === 0) {
    return skipped('No allocatable package is available, so there is nothing to allocate.');
  }

  let itemCount = 0;
  let enumerationCount = 1;
  while (itemCount < items.length && enumerationCount * base <= limit) {
    enumerationCount *= base;
    itemCount++;
  }

  if (itemCount === 0) {
    return skipped(
      `Even one package on ${capacities.length} vehicle(s) needs ${base} assignments, ` +
        `above the ${limit} limit.`,
    );
  }

  const prefix = items.slice(0, itemCount);
  const dp = solveMultipleKnapsack(prefix, capacities, { maxStates });
  const exhaustiveValue = exhaustiveBestValue(prefix, capacities);
  const match = Math.abs(dp.totalValue - exhaustiveValue) <= EPSILON;

  return {
    attempted: true,
    reason: null,
    itemCount,
    requestedItemCount: items.length,
    vehicleCount: capacities.length,
    enumerationCount,
    enumerationLimit: limit,
    dpValue: dp.totalValue,
    exhaustiveValue,
    match,
    reduced: itemCount < items.length,
    dp,
  };
}

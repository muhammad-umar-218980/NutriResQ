/**
 * Pure helpers behind the scenario simulator.
 *
 * Nothing here touches the database: the state-space guard, the metric deltas
 * and the urgency ranking are decisions that must be reproducible and testable
 * without a live scenario.
 */

import type { Metrics, MetricDelta, RecipientRecord } from '../types/domain';

/**
 * Exact multiple-knapsack DP state count for a fleet: prod(capacity_j + 1).
 *
 * Capacities are integers in kilograms, so a 60 kg van contributes 61
 * capacity values (0..60). The product is clamped at
 * `Number.MAX_SAFE_INTEGER` so an impossible fleet cannot silently wrap into a
 * small number and slip past the guard.
 */
export function projectedStateCount(capacities: readonly number[]): number {
  let total = 1;

  for (const capacity of capacities) {
    const width = Math.max(1, Math.floor(capacity) + 1);
    if (total > Number.MAX_SAFE_INTEGER / width) return Number.MAX_SAFE_INTEGER;
    total *= width;
  }

  return total;
}

/** Packages actually assigned to a vehicle, derived from a stored result. */
export function packagesAllocated(counts: readonly number[]): number {
  return counts.reduce((sum, count) => sum + count, 0);
}

export interface MetricDeltaInput {
  metrics: Metrics | null;
  packagesAllocated: number;
  status: string;
}

type NumericMetricKey = {
  [K in keyof Metrics]: Metrics[K] extends number ? K : never;
}[keyof Metrics];

const TRACKED_METRICS: ReadonlyArray<{
  key: NumericMetricKey | 'packagesAllocated';
  label: string;
  unit: string;
  lowerIsBetter: boolean;
}> = [
  {
    key: 'allocatedPackageValue',
    label: 'Allocated objective value',
    unit: 'value',
    lowerIsBetter: false,
  },
  {
    key: 'allocatedPackageWeightUnits',
    label: 'Allocated weight',
    unit: 'kg',
    lowerIsBetter: false,
  },
  { key: 'packagesAllocated', label: 'Packages served', unit: 'packages', lowerIsBetter: false },
  {
    key: 'vehicleCapacityUtilization',
    label: 'Capacity utilisation',
    unit: '%',
    lowerIsBetter: false,
  },
  { key: 'totalRoadCost', label: 'Measured road cost', unit: 'km', lowerIsBetter: true },
  { key: 'unallocatedPackageCount', label: 'Unallocated packages', unit: 'packages', lowerIsBetter: true },
  { key: 'routeCount', label: 'Routes', unit: 'routes', lowerIsBetter: false },
  { key: 'partialRouteCount', label: 'Partial routes', unit: 'routes', lowerIsBetter: true },
  { key: 'unreachablePairCount', label: 'Unreachable pairs', unit: 'pairs', lowerIsBetter: true },
  { key: 'runtimeMs', label: 'Server runtime', unit: 'ms', lowerIsBetter: true },
];

function readMetric(
  input: MetricDeltaInput,
  key: NumericMetricKey | 'packagesAllocated',
): number {
  if (key === 'packagesAllocated') return input.packagesAllocated;
  if (!input.metrics) return 0;
  return input.metrics[key];
}

/**
 * Absolute and relative change for every metric the simulator reports.
 * A relative change is `null` when the base is zero: dividing by zero would
 * invent a percentage that never happened.
 */
export function metricDeltas(base: MetricDeltaInput, variant: MetricDeltaInput): MetricDelta[] {
  return TRACKED_METRICS.map((entry) => {
    const baseValue = readMetric(base, entry.key);
    const variantValue = readMetric(variant, entry.key);
    const delta = variantValue - baseValue;

    return {
      metric: entry.key,
      label: entry.label,
      unit: entry.unit,
      base: baseValue,
      variant: variantValue,
      delta,
      deltaPercent: baseValue === 0 ? null : (delta / baseValue) * 100,
      lowerIsBetter: entry.lowerIsBetter,
    };
  });
}

/**
 * Deterministic urgency ranking used by the sensitivity step: highest priority
 * first, then the larger recorded demand, then name so ties never depend on
 * database row order.
 */
export function selectTopUrgencyRecipients<T extends Pick<RecipientRecord, 'name' | 'priorityScore' | 'demandUnits'>>(
  recipients: readonly T[],
  count: number,
): T[] {
  const ranked = [...recipients].sort((left, right) => {
    if (right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore;
    if (right.demandUnits !== left.demandUnits) return right.demandUnits - left.demandUnits;
    return left.name.localeCompare(right.name);
  });

  return ranked.slice(0, Math.max(0, Math.min(count, ranked.length)));
}

/** Default name for a variant; the admin can override it when cloning. */
export function defaultVariantName(baseName: string): string {
  const name = `${baseName} — variant`;
  return name.length <= 120 ? name : `${name.slice(0, 117)}…`;
}

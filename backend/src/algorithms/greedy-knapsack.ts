/**
 * Greedy Knapsack Baseline - for Multiple-knapsack DP Comparison.
 *
 * As specified in PRD.md FR-20: "Compare against a documented greedy baseline using the same input and objective."
 *
 * The greedy approach provides a quick approximation to the DP optimal solution.
 * It does not guarantee optimality but runs in O(n log n) or O(n) time.
 *
 * Greedy strategy: sort packages by value-to-weight ratio (value density) and
 * assign each package to the first vehicle that can carry it, without exceeding
 * any vehicle's capacity.
 *
 * Key properties:
 * - Runs in O(n log n) for sorting + O(n * m) for assignment (n packages, m vehicles)
 * - Never exceeds vehicle capacities (by construction)
 * - Each package assigned at most once (by construction)
 * - May not maximize total value compared to DP optimal solution
 * - Provides a feasible (but possibly suboptimal) baseline for comparison
 *
 * Comparison metrics with DP (from PRD.md product metrics):
 * - total eligible package value allocated (DP >= Greedy typically)
 * - total package weight allocated
 * - number and reasons of unallocated packages
 * - vehicle capacity utilization (%)
 */
export interface GreedyPackage {
  id: number; // package id
  weight: number; // weight in DP units
  value: number; // value/priority score
  valueToWeightRatio: number; // value / weight for sorting
}

/**
 * Vehicle for greedy knapsack assignment.
 */
export interface GreedyVehicle {
  id: number; // vehicle id
  capacity: number; // remaining capacity (decreases as packages assigned)
  maxCapacity: number; // original capacity
  assignedPackages: number[]; // package ids assigned to this vehicle
  totalWeight: number; // total weight of assigned packages
  totalValue: number; // total value of assigned packages
}

/**
 * Run greedy knapsack allocation.
 *
 * Strategy: Sort packages by value-to-weight ratio (highest first),
 * then for each package, assign it to the first vehicle that can accommodate it.
 *
 * @param packages Array of greedy packages with weights, values, and value/weight ratios
 * @param vehicles Array of vehicles with their capacities
 * @returns GreedyAllocationResult containing assignments, unallocated packages, and metrics
 *
 * Algorithm:
 * 1. Sort packages in descending order of valueToWeightRatio
 * 2. For each package (in sorted order):
 *    a. Find the first vehicle with sufficient remaining capacity
 *    b. If found, assign package to that vehicle, update vehicle state
 *    c. If not found, package remains unallocated
 * 3. Return assignments and metrics
 *
 * Properties:
 * - No package exceeds any vehicle's capacity (by construction)
 * - Each package assigned at most once
 * - May leave packages unallocated if no vehicle has sufficient capacity
 * - Value allocation may be suboptimal compared to DP (but feasible)
 *
 * Example from PRD.md FR-20:
 * "Compare against a documented greedy baseline using the same input and objective."
 * - Same packages, same vehicles, same capacity constraints
 * - Report measured result quality (value allocated) and runtime
 */
export function greedyKnapsackAllocation(
  packages: GreedyPackage[],
  vehicles: GreedyVehicle[]
): {
  assignments: GreedyPackage[][]; // assignments[i] = packages assigned to vehicle i
  unallocated: GreedyPackage[]; // packages that could not be assigned
  vehicles: GreedyVehicle[]; // vehicles with updated state
  metrics: {
    totalValueAllocated: number; // sum of values of all allocated packages
    totalWeightAllocated: number; // sum of weights of all allocated packages
    totalValueCapacity: number; // total capacity across all vehicles
    totalWeightCapacity: number; // total weight capacity across all vehicles
    vehicleUtilization: number; // percentage: totalWeightAllocated / totalWeightCapacity
    numUnallocated: number; // packages that could not be assigned
    numPackages: number; // total number of packages
    numVehicles: number; // total number of vehicles
  };
} {
  // Make shallow copies to avoid mutating original arrays
  const pkgCopy = packages.map(p => ({
    id: p.id,
    weight: p.weight,
    value: p.value,
    valueToWeightRatio: p.valueToWeightRatio,
  }));

  const vehCopy = vehicles.map(v => ({
    id: v.id,
    capacity: v.capacity,
    maxCapacity: v.maxCapacity,
    assignedPackages: [...v.assignedPackages],
    totalWeight: v.totalWeight,
    totalValue: v.totalValue,
  }));

  // Sort packages by value-to-weight ratio in descending order
  pkgCopy.sort((a, b) => b.valueToWeightRatio - a.valueToWeightRatio);

  // Track unallocated packages
  const unallocated: GreedyPackage[] = [];

  // For each package (highest value/weight ratio first)
  for (const pkg of pkgCopy) {
    let assigned = false;

    // Find the first vehicle with sufficient capacity
    for (const veh of vehCopy) {
      if (veh.capacity >= pkg.weight) {
        // Assign package to this vehicle
        veh.assignedPackages.push(pkg.id);
        veh.capacity -= pkg.weight;
        veh.totalWeight += pkg.weight;
        veh.totalValue += pkg.value;
        assigned = true;
        break;
      }
    }

    // If no vehicle could accommodate this package
    if (!assigned) {
      unallocated.push(pkg);
    }
  }

  // Compute metrics
  const totalValueAllocated = vehCopy.reduce(
    (sum, veh) => sum + veh.totalValue,
    0
  );
  const totalWeightAllocated = vehCopy.reduce(
    (sum, veh) => sum + veh.totalWeight,
    0
  );
  const totalWeightCapacity = vehCopy.reduce(
    (sum, veh) => sum + veh.maxCapacity,
    0
  );
  const vehicleUtilization =
    totalWeightCapacity > 0
      ? (totalWeightAllocated / totalWeightCapacity) * 100
      : 0;

  const assignments = vehCopy.map(veh => veh.assignedPackages.map(
    pkgId => pkgCopy.find(p => p.id === pkgId) ?? { id: pkgId, weight: 0, value: 0, valueToWeightRatio: 0 }
  ));

  return {
    assignments,
    unallocated,
    vehicles: vehCopy,
    metrics: {
      totalValueAllocated,
      totalWeightAllocated,
      totalValueCapacity: totalWeightCapacity, // this is actually max capacity sum
      totalWeightCapacity,
      vehicleUtilization,
      numUnallocated: unallocated.length,
      numPackages: pkgCopy.length,
      numVehicles: vehCopy.length,
    },
  };
}

/**
 * Create greedy packages from knapsack-compatible input.
 *
 * Converts the DP-style package data (weights, values) into greedy-compatible format,
 * computing the value-to-weight ratio for sorting.
 *
 * @param weights 1-indexed array of package weights (weights[0] is placeholder)
 * @param values 1-indexed array of package values (values[0] is placeholder)
 * @returns Array of GreedyPackage with computed ratios
 *
 * Note: If any weight is 0, the ratio is set to 0 to avoid division by zero.
 * Package with weight 0 and positive value would be sorted first (infinite ratio),
 * but such cases should be caught by input validation.
 */
export function createGreedyPackages(
  weights: number[],
  values: number[]
): GreedyPackage[] {
  const packages: GreedyPackage[] = [];

  for (let i = 1; i < weights.length; i++) {
    // Skip if weight is null/undefined (index 0 is the placeholder)
    if (weights[i] === undefined || weights[i] === null) continue;
    if (weights[i] <= 0) continue; // skip invalid weights

    const value = values[i] !== undefined ? values[i] : 0;
    const ratio = weights[i] > 0 ? value / weights[i] : 0;

    packages.push({
      id: i,
      weight: weights[i],
      value: ratio > 0 ? value : 0, // use actual value, not ratio
      valueToWeightRatio: ratio,
    });
  }

  return packages;
}

/**
 * Create greedy vehicles from DP-style vehicle capacity data.
 *
 * @param vehicleCapacities Array of vehicle capacity values (integers in DP weight units)
 * @param vehicleIds Optional custom ids; if not provided, uses sequential ids starting from 1
 * @returns Array of GreedyVehicle with initialized capacity state
 */
export function createGreedyVehicles(
  vehicleCapacities: number[],
  vehicleIds?: number[]
): GreedyVehicle[] {
  const ids = vehicleIds ?? Array.from({ length: vehicleCapacities.length }, (_, i) => i + 1);

  return vehicleCapacities.map((capacity, index) => ({
    id: ids[index],
    capacity: capacity, // remaining capacity, starts at max
    maxCapacity: capacity,
    assignedPackages: [],
    totalWeight: 0,
    totalValue: 0,
  }));
}

/**
 * Full greedy knapsack workflow from raw DP inputs.
 *
 * @param n Number of packages
 * @param W Knapsack capacity (not directly used by greedy, but for validation)
 * @param weights 1-indexed weights array (weights[0] placeholder)
 * @param values 1-indexed values array (values[0] placeholder)
 * @param vehicleCapacities Array of vehicle capacities (each vehicle's max weight capacity)
 * @returns Complete greedy allocation result with assignments, unallocated, and metrics
 */
export function runGreedyKnapsack(
  n: number,
  W: number,
  weights: number[],
  values: number[],
  vehicleCapacities: number[]
) {
  // Create greedy packages
  const packages = createGreedyPackages(weights, values);

  // Create greedy vehicles
  const vehicles = createGreedyVehicles(vehicleCapacities);

  // Run greedy allocation
  const result = greedyKnapsackAllocation(packages, vehicles);

  return result;
}

/**
 * Compare greedy knapsack vs DP optimal on the same inputs.
 *
 * Returns both the greedy allocation result and the DP optimal value so the caller
 * can compute the gap and other comparison metrics.
 *
 * From PRD.md FR-20: "Compare against a documented greedy baseline using the same input and objective."
 *
 * @param n Number of packages
 * @param W Knapsack capacity
 * @param weights 1-indexed weights array
 * @param values 1-indexed values array
 * @param vehicleCapacities Array of vehicle capacities
 * @returns Object with greedy result and DP comparison value
 */
export function compareGreedyDP(
  n: number,
  W: number,
  weights: number[],
  values: number[],
  vehicleCapacities: number[]
) {
  // Run greedy
  const greedyResult = runGreedyKnapsack(n, W, weights, values, vehicleCapacities);

  // Run DP optimal (using the memory function from multiple-knapsack-dp.ts)
  const dpOptimalValue = require('./multiple-knapsack-dp').solveKnapsack(
    n,
    W,
    weights,
    values
  );

  // Compute efficiency gap
  const efficiencyGap =
    greedyResult.metrics.totalValueAllocated > 0
      ? ((dpOptimalValue - greedyResult.metrics.totalValueAllocated) /
          dpOptimalValue) * 100
      : 0;

  return {
    greedy: {
      ...greedyResult.metrics,
      assignments: greedyResult.assignments,
      unallocatedCount: greedyResult.unallocated.length,
    },
    dpOptimalValue,
    efficiencyGapPercentage: efficiencyGap,
    comparison: {
      greedyValueAllocated: greedyResult.metrics.totalValueAllocated,
      dpOptimalValue,
      gapAbsolute: dpOptimalValue - greedyResult.metrics.totalValueAllocated,
      gapPercentage: efficiencyGap,
      dpIsBetter: dpOptimalValue >= greedyResult.metrics.totalValueAllocated,
      // Note: DP may find partial feasible allocation; gap reflects quality difference
    },
  };
}
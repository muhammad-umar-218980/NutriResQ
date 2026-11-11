/**
 * Multiple Knapsack using Dynamic Programming - Memory Function method.
 *
 * As specified in Chapter 7 of the D&AA course material:
 * - 1-indexed: item 1 weight=2, item 2 weight=1, etc.
 * - Weights = [null, 2, 1, 3, 2]; Values = [null, 12, 10, 20, 15]
 * - F[0..n, 0..W] memory table with F[i, j] = value of optimal feasible subset
 * - using MFKnapsack(i, j) recursive function with memoization
 *
 * Package assignment: each package assigned at most once to one vehicle.
 * Capacity constraint: never exceed vehicle's capacity.
 * Report ineligible/oversized packages rather than silently losing them.
 * Return best feasible partial allocation if not all packages can be assigned.
 *
 * Integer scaling: weights and capacities must be documented integer units.
 * Package value_score must be explicit and consistent non-negative integer.
 */

/**
 * Memory function for knapsack problem.
 * Recursively computes optimal value for i items and capacity j.
 *
 * @param i Number of items being considered (1-indexed)
 * @param j Current knapsack capacity
 * @param weights 1-indexed array of package weights (weights[0] = null placeholder, but used as number[])
 * @param values 1-indexed array of package values (values[0] = null placeholder, but used as number[])
 * @param F Memoization table F[0..n, 0..W] initialized with -1, 0 on row/col 0
 * @returns The value of an optimal feasible subset
 */
function mFKnapsack(
  i: number,
  j: number,
  weights: number[],
  values: number[],
  F: number[][]
): number {
  if (F[i][j] < 0) {
    let value: number;

    if (j < weights[i]) {
      value = mFKnapsack(i - 1, j, weights, values, F);
    } else {
      value = Math.max(
        mFKnapsack(i - 1, j, weights, values, F),
        values[i] + mFKnapsack(i - 1, j - weights[i], weights, values, F)
      );
    }

    F[i][j] = value;
  }

  return F[i][j];
}

/**
 * Initialize the DP memoization table F[0..n][0..W].
 * Row 0 and column 0 initialized to 0, remaining cells initialized to -1.
 *
 * @param n Number of items/packages
 * @param W Total knapsack capacity
 * @returns Initialized table F where F[i][j] = 0 for i=0 or j=0, else -1
 */
function initializeDPTable(n: number, W: number): number[][] {
  const F: number[][] = [];

  for (let i = 0; i <= n; i++) {
    F[i] = [];
    for (let j = 0; j <= W; j++) {
      if (i === 0 || j === 0) {
        F[i][j] = 0;
      } else {
        F[i][j] = -1;
      }
    }
  }

  return F;
}

/**
 * Solve the 0/1 knapsack problem using memory function (recursive with memoization).
 *
 * @param n Number of items/packages (1-indexed count)
 * @param W Total knapsack capacity
 * @param weights 1-indexed array of weights (weights[0] is placeholder, should be number)
 * @param values 1-indexed array of values (values[0] is placeholder, should be number)
 * @returns Optimal knapsack value (maximum total value without exceeding capacity)
 *
 * Example from Chapter 7:
 * n = 4, W = 5
 * Weights = [null, 2, 1, 3, 2]
 * Values = [null, 12, 10, 20, 15]
 * Expected optimal value: 32 (items 1 and 3: weight 2+3=5, value 12+20=32)
 */
export function solveKnapsack(
  n: number,
  W: number,
  weights: number[],
  values: number[]
): number {
  // Ensure arrays have at least n+1 elements (index 0 is placeholder)
  let w: number[] = weights;
  let v: number[] = values;

  // Pad arrays if needed
  if (w.length < n + 1) {
    const newW: number[] = [0]; // Use 0 as placeholder instead of null
    for (let i = 0; i < w.length; i++) newW[i] = w[i];
    // Fill remaining with 0
    for (let i = w.length; i <= n; i++) newW[i] = 0;
    w = newW;
  }
  if (v.length < n + 1) {
    const newV: number[] = [0]; // Use 0 as placeholder instead of null
    for (let i = 0; i < v.length; i++) newV[i] = v[i];
    // Fill remaining with 0
    for (let i = v.length; i <= n; i++) newV[i] = 0;
    v = newV;
  }

  // Trim to n+1 elements (indices 0..n)
  if (w.length > n + 1) w = w.slice(0, n + 1);
  if (v.length > n + 1) v = v.slice(0, n + 1);

  // Initialize DP table
  const F = initializeDPTable(n, W);

  // Call algorithm
  return mFKnapsack(n, W, w, v, F);
}

/**
 * Validate knapsack input before running the DP algorithm.
 *
 * @param n Number of packages
 * @param W Knapsack capacity
 * @param weights Package weights array (1-indexed, weights[0] should be number)
 * @param values Package values array (1-indexed, values[0] should be number)
 * @returns Validation result with errors if any
 */
export function validateKnapsackInput(
  n: number,
  W: number,
  weights: number[],
  values: number[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (n <= 0) {
    errors.push('Number of items must be positive');
  }

  if (W <= 0) {
    errors.push('Knapsack capacity must be positive');
  }

  if (weights.length < n + 1) {
    errors.push('Weights array must be 1-indexed with at least n+1 elements');
  }

  if (values.length < n + 1) {
    errors.push('Values array must be 1-indexed with at least n+1 elements');
  }

  for (let i = 1; i <= n; i++) {
    if (weights[i] === undefined || weights[i] === null) {
      errors.push(`Weight for item ${i} is undefined`);
    } else if (weights[i] <= 0) {
      errors.push(`Weight for item ${i} must be positive, got ${weights[i]}`);
    }

    if (values[i] === undefined || values[i] === null) {
      errors.push(`Value for item ${i} is undefined`);
    } else if (values[i] < 0) {
      errors.push(`Value for item ${i} must be non-negative, got ${values[i]}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Multiple-knapsack input: one indivisible package.
 *
 * Units (see docs/IMPLEMENTATION_PLAN.md): `weightUnits` is kilograms as an
 * integer (1 unit = 1 kg), `value` is a non-negative integer objective.
 */
export interface MultipleKnapsackItem {
  /** Caller identifier (for the API this is the donation id). */
  id?: string;
  weightUnits: number;
  value: number;
}

export interface MultipleKnapsackOptions {
  /**
   * Hard ceiling on the mixed-radix state space, `prod(capacity + 1)`.
   * Exceeding it throws instead of silently falling back to an approximation.
   */
  maxStates: number;
}

export interface MultipleKnapsackAssignment {
  vehicleIndex: number;
  /** Indexes into the `items` array passed by the caller. */
  itemIndexes: number[];
  totalWeightUnits: number;
  totalValue: number;
}

export type MultipleKnapsackUnallocatedReason =
  | 'invalid'
  | 'oversized'
  | 'insufficient_capacity'
  | 'no_vehicle';

export interface MultipleKnapsackUnallocated {
  itemIndex: number;
  reason: MultipleKnapsackUnallocatedReason;
  detail: string;
}

export interface MultipleKnapsackResult {
  /** One entry per vehicle, in the order the capacities were supplied. */
  assignments: MultipleKnapsackAssignment[];
  totalValue: number;
  totalWeightUnits: number;
  /** Mixed-radix state count actually allocated, `prod(capacity + 1)`. */
  stateCount: number;
  maxStates: number;
  /** True: the DP enumerates every capacity vector, so the result is optimal. */
  exact: true;
  unallocated: MultipleKnapsackUnallocated[];
}

/**
 * Exact multiple-knapsack DP over the joint capacity vector.
 *
 * State = how much of each vehicle's capacity is already used, encoded as a
 * mixed-radix integer (`radix[v] = prod_{u<v}(capacity[u] + 1)`). For every
 * package the DP considers skipping it or placing it on each vehicle that still
 * has room; because packages are processed once, a package can never be
 * assigned twice. The final state with the greatest total value is decoded back
 * into per-vehicle item indexes.
 *
 * Complexity: O(n * m * prod(capacity + 1)) time, O(n * prod(capacity + 1))
 * memory for the backtracking rows. When the state space would exceed
 * `maxStates` this throws a RangeError rather than approximating.
 */
export function solveMultipleKnapsack(
  items: MultipleKnapsackItem[],
  capacities: number[],
  options: MultipleKnapsackOptions,
): MultipleKnapsackResult {
  const maxStates = options.maxStates;

  if (!Number.isFinite(maxStates) || !Number.isInteger(maxStates) || maxStates <= 0) {
    throw new RangeError('maxStates must be a positive integer.');
  }

  const vehicleCount = capacities.length;
  const capacityLimit: number[] = [];

  for (let v = 0; v < vehicleCount; v++) {
    const capacity = capacities[v];
    if (!Number.isInteger(capacity) || capacity < 0) {
      throw new RangeError(
        `Vehicle ${v} capacity must be a non-negative integer in the same unit as package weights, got ${capacity}.`,
      );
    }
    capacityLimit.push(capacity);
  }

  // radix[v] is the state increment for using one more unit of vehicle v.
  const radix: number[] = [];
  let stateCount = 1;
  for (let v = 0; v < vehicleCount; v++) {
    radix.push(stateCount);
    stateCount *= capacityLimit[v] + 1;
    if (stateCount > maxStates) {
      throw new RangeError(
        `Multiple-knapsack state space is ${stateCount} states, above maxStates=${maxStates}. ` +
          'The exact DP was not run; reduce vehicle capacities, remove vehicles, or raise maxStates.',
      );
    }
  }

  const unallocated: MultipleKnapsackUnallocated[] = [];
  const valid: Array<{ originalIndex: number; weight: number; value: number }> = [];
  const maxCapacity = capacityLimit.reduce((max, capacity) => Math.max(max, capacity), 0);

  for (let index = 0; index < items.length; index++) {
    const item = items[index];

    if (!Number.isInteger(item.weightUnits) || item.weightUnits <= 0) {
      unallocated.push({
        itemIndex: index,
        reason: 'invalid',
        detail: `Weight must be a positive integer number of units, got ${item.weightUnits}.`,
      });
      continue;
    }

    if (!Number.isFinite(item.value) || item.value < 0) {
      unallocated.push({
        itemIndex: index,
        reason: 'invalid',
        detail: `Value must be a finite non-negative number, got ${item.value}.`,
      });
      continue;
    }

    if (vehicleCount === 0) {
      unallocated.push({
        itemIndex: index,
        reason: 'no_vehicle',
        detail: 'No vehicles were supplied.',
      });
      continue;
    }

    if (item.weightUnits > maxCapacity) {
      unallocated.push({
        itemIndex: index,
        reason: 'oversized',
        detail: `Package weighs ${item.weightUnits} units; the largest vehicle holds ${maxCapacity}.`,
      });
      continue;
    }

    valid.push({ originalIndex: index, weight: item.weightUnits, value: item.value });
  }

  const assignedItems: number[][] = Array.from({ length: vehicleCount }, () => []);

  if (vehicleCount === 0) {
    return {
      assignments: [],
      totalValue: 0,
      totalWeightUnits: 0,
      stateCount,
      maxStates,
      exact: true,
      unallocated,
    };
  }

  // dp[s] = best value reachable using some subset of the processed packages
  // and leaving each vehicle with the usage pattern encoded by s. -1 = unreachable.
  let dp = new Float64Array(stateCount).fill(-1);
  dp[0] = 0;

  const history: Array<{ vehicle: Int16Array; prevState: Int32Array }> = [];

  for (const item of valid) {
    const next = Float64Array.from(dp); // skipping the package keeps the state
    const prevState = new Int32Array(stateCount);
    const vehicleChoice = new Int16Array(stateCount);

    for (let state = 0; state < stateCount; state++) {
      if (dp[state] >= 0) prevState[state] = state;
    }

    for (let state = 0; state < stateCount; state++) {
      const baseValue = dp[state];
      if (baseValue < 0) continue;

      let remainder = state;
      for (let v = 0; v < vehicleCount; v++) {
        const size = capacityLimit[v] + 1;
        const used = remainder % size;
        remainder = Math.floor(remainder / size);

        if (used + item.weight > capacityLimit[v]) continue;

        const nextState = state + radix[v] * item.weight;
        const candidate = baseValue + item.value;
        // Strict comparison keeps the lowest vehicle index on ties.
        if (candidate > next[nextState]) {
          next[nextState] = candidate;
          prevState[nextState] = state;
          vehicleChoice[nextState] = v + 1;
        }
      }
    }

    history.push({ vehicle: vehicleChoice, prevState });
    dp = next;
  }

  let bestState = 0;
  for (let state = 1; state < stateCount; state++) {
    if (dp[state] > dp[bestState]) bestState = state;
  }

  let state = bestState;
  for (let i = valid.length - 1; i >= 0; i--) {
    const choice = history[i].vehicle[state];
    if (choice > 0) {
      assignedItems[choice - 1].push(valid[i].originalIndex);
      state = history[i].prevState[state];
    }
  }

  const validByIndex = new Map(valid.map((item) => [item.originalIndex, item]));
  const assigned = new Set<number>();
  let totalValue = 0;
  let totalWeightUnits = 0;

  const assignments: MultipleKnapsackAssignment[] = assignedItems.map((itemIndexes, vehicleIndex) => {
    let weight = 0;
    let value = 0;
    for (const index of itemIndexes) {
      const item = validByIndex.get(index)!;
      weight += item.weight;
      value += item.value;
      assigned.add(index);
    }
    totalValue += value;
    totalWeightUnits += weight;
    return {
      vehicleIndex,
      itemIndexes: [...itemIndexes].sort((a, b) => a - b),
      totalWeightUnits: weight,
      totalValue: value,
    };
  });

  for (const item of valid) {
    if (!assigned.has(item.originalIndex)) {
      unallocated.push({
        itemIndex: item.originalIndex,
        reason: 'insufficient_capacity',
        detail:
          'Not part of the value-maximising assignment: adding it would require exceeding capacity or dropping higher-value packages.',
      });
    }
  }

  unallocated.sort((a, b) => a.itemIndex - b.itemIndex);

  return {
    assignments,
    totalValue,
    totalWeightUnits,
    stateCount,
    maxStates,
    exact: true,
    unallocated,
  };
}

/**
 * Example usage from Chapter 7 PDF specifications.
 * n = 4 items, W = 5 capacity
 * Weights = [null, 2, 1, 3, 2] (1-indexed)
 * Values = [null, 12, 10, 20, 15] (1-indexed)
 */
export function runChapter7Example(): {
  optimalValue: number;
  dpTable: number[][];
  validation: { valid: boolean; errors: string[] };
} {
  const n = 4;
  const W = 5;
  // Use the exact example from Chapter 7 - pass numbers, the function handles the null placeholder internally
  const weights: number[] = [2, 1, 3, 2]; // index 0 is ignored, uses indices 1-4
  const values: number[] = [12, 10, 20, 15]; // index 0 is ignored, uses indices 1-4

  const optimalValue = solveKnapsack(n, W, weights, values);

  return {
    optimalValue,
    dpTable: initializeDPTable(n, W),
    validation: validateKnapsackInput(n, W, weights, values),
  };
}
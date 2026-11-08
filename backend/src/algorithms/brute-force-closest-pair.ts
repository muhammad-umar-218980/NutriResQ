/**
 * Brute-Force Closest Pair - Baseline for Closest Pair Comparison.
 *
 * As specified in PRD.md FR-25: "Compare with a brute-force baseline on identical points."
 * and FR-23: "State the coordinate/distance model and units in the result."
 *
 * The brute-force approach computes the distance between ALL pairs of points
 * and returns the minimum. It is O(n^2) but guaranteed to find the true closest pair.
 *
 * Used for comparison with the divide-and-conquer EfficientClosestPair algorithm.
 * Both must use the same coordinate system, distance model, and units.
 *
 * Coordinate system: planar Euclidean coordinates {x, y}
 * Distance model: Euclidean distance d(p1, p2) = sqrt((p1.x - p2.x)^2 + (p1.y - p2.y)^2)
 * Units: distance units consistent with the projected coordinate system
 *
 * Key properties:
 * - Always returns the correct closest pair distance (optimal)
 * - Computational complexity: O(n^2) - impractical for large n
 * - Simple implementation, easy to verify correctness
 * - Must use the same distance model as the divide-and-conquer algorithm
 *
 * Comparison with EfficientClosestPair (from Chapter 5):
 * - Both must produce identical results on the same input point set
 * - Brute-force is O(n^2), divide-and-conquer is O(n log n)
 * - Results should agree "within the same distance model" (PRD.md FR-25)
 * - Both handle duplicate coordinates and < 2 points similarly
 */
export interface BruteForceClosestPairResult {
  /** Minimum Euclidean distance found between any pair */
  minDistance: number;
  /** The pair of points achieving the minimum distance */
  p1: { x: number; y: number } | null;
  p2: { x: number; y: number } | null;
  /** Number of distance comparisons performed */
  comparisons: number;
}

/* Import efficientClosestPair from closest-pair module */
import { efficientClosestPair } from './closest-pair';

/**
 * Compute the closest pair using brute-force O(n^2) algorithm.
 *
 * @param points Array of 2D points {x, y} with planar Euclidean coordinates
 * @returns BruteForceClosestPairResult containing the minimum distance and the pair
 *
 * Algorithm:
 * 1. Initialize minDist = Infinity, comparisons = 0
 * 2. For each pair (i, j) where i < j:
 *    a. Increment comparisons counter
 *    b. Compute Euclidean distance d = sqrt((xi - xj)^2 + (yi - yj)^2)
 *    c. If d < minDist, update minDist = d, save p1 = points[i], p2 = points[j]
 * 3. Return result with minDistance and the achieving pair
 *
 * Special cases:
 * - Fewer than 2 points: return { minDistance: Infinity, p1: null, p2: null, comparisons: 0 }
 * - Duplicate coordinates: distance 0 will be detected correctly
 * - Exactly 2 points: single comparison, returns that distance
 */
export function bruteForceClosestPair(
  points: { x: number; y: number }[]
): BruteForceClosestPairResult {
  const n = points.length;

  if (n < 2) {
    return {
      minDistance: Infinity,
      p1: null,
      p2: null,
      comparisons: 0,
    };
  }

  let minDist = Infinity;
  let p1: { x: number; y: number } | null = null;
  let p2: { x: number; y: number } | null = null;
  let comparisons = 0;

  // Compare all pairs (i, j) with i < j
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      comparisons++;

      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dist = Math.sqrt(dx ** 2 + dy ** 2);

      if (dist < minDist) {
        minDist = dist;
        p1 = { x: points[i].x, y: points[i].y };
        p2 = { x: points[j].x, y: points[j].y };
      }
    }
  }

  return {
    minDistance: minDist,
    p1,
    p2,
    comparisons: n * (n - 1) / 2, // exact number, but we tracked individually
  };
}

/**
 * Validate brute-force closest pair input.
 *
 * @param points Array of 2D points to validate
 * @returns Validation result
 */
export function validateBruteForceClosestPair(
  points: { x: number; y: number }[]
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (points.length < 2) {
    errors.push('Point set must contain at least 2 points for closest pair computation');
  }

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (typeof p.x !== 'number' || typeof p.y !== 'number') {
      errors.push(`Point ${i} must have numeric x and y coordinates`);
    }
    if (!isFinite(p.x) || !isFinite(p.y)) {
      errors.push(`Point ${i} must have finite x and y coordinates`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Compare brute-force vs divide-and-conquer closest pair on the same inputs.
 *
 * From PRD.md FR-25: "Compare with a brute-force baseline on identical points, within the same distance model."
 *
 * @param points Array of 2D points
 * @returns Comparison result with both algorithms' outputs and agreement flag
 */
export function compareBruteForceDCP(
  points: { x: number; y: number }[]
) {
  // Brute force
  const bfResult = bruteForceClosestPair(points);

  // For divide-and-conquer, we need to pre-sort
  const P = [...points].sort((a, b) => a.x - b.x);
  const Q = [...points].sort((a, b) => a.y - b.y);

  // Efficient closest pair
  const dcResult = efficientClosestPair(P, Q);

  // Note: efficientClosestPair returns just the distance, not the pair.
  // For comparison, we check if distances agree within floating-point tolerance.
  const distanceAgrees =
    Math.abs(bfResult.minDistance - dcResult) < 1e-10;

  return {
    bruteForce: {
      minDistance: bfResult.minDistance,
      p1: bfResult.p1,
      p2: bfResult.p2,
      comparisons: bfResult.comparisons,
    },
    divideAndConquer: {
      minDistance: dcResult,
    },
    agreement: {
      distancesAgree: distanceAgrees,
      absoluteDifference: Math.abs(bfResult.minDistance - dcResult),
      relativeDifference:
        bfResult.minDistance > 0
          ? Math.abs(bfResult.minDistance - dcResult) / bfResult.minDistance
          : 0,
    },
    comparison: {
      bruteForceComparisons: bfResult.comparisons,
      // Divide and conquer is O(n log n), so for small n brute force may be comparable
      // For large n, DC should be significantly faster
    },
  };
}
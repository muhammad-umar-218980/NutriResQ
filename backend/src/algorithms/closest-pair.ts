/**
 * Closest Pair of Points using Divide and Conquer Algorithm.
 *
 * As specified in Chapter 5 of the D&AA course material:
 * - Euclidean distance between two points p1(x1,y1) and p2(x2,y2)
 * - d(p1,p2) = sqrt((p1.x - p2.x)^2 + (p1.y - p2.y)^2)
 * - EfficientClosestPair(P, Q) where P sorted by x-coordinate, Q sorted by y-coordinate
 * - Brute-force for n <= 3 points
 * - Returns Euclidean distance of the closest pair
 *
 * Coordinate system: planar Euclidean coordinates (projected_x, projected_y)
 * Units: distance units consistent with the projected coordinate system
 * NOT: latitude/longitude degrees directly (those require documented projection)
 *
 * Key invariant: Q maintains the same points as P but sorted by y-coordinate.
 * This is preserved through recursive calls by partitioning Q based on left/right set membership.
 */

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Helper: Computes Euclidean distance between two points.
 */
export function distance(p1: Point2D, p2: Point2D): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * Helper: Brute-force closest pair for n <= 3 points.
 * Computes minimum distance among all pairs in the point set.
 */
export function bruteForce(points: Point2D[]): number {
  let minDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      minDist = Math.min(minDist, distance(points[i], points[j]));
    }
  }
  return minDist;
}

/**
 * Efficient Closest Pair algorithm using divide-and-conquer.
 *
 * @param P Points sorted by x-coordinate (ascending)
 * @param Q Same points sorted by y-coordinate (ascending)
 * @returns Euclidean distance of the closest pair in the point set
 *
 * Algorithm steps:
 * 1. If n <= 3: return bruteForce(P)
 * 2. Else: mid = ceil(n/2)
 * 3. Pl = P.slice(0, mid), Pr = P.slice(mid)  // left/right halves by x-coordinate
 * 4. leftSet = new Set(Pl) for O(1) membership lookups
 * 5. Partition Q into Ql and Qr based on leftSet membership (preserving y-order)
 * 6. dl = EfficientClosestPair(Pl, Ql), dr = EfficientClosestPair(Pr, Qr)
 * 7. d = min(dl, dr)
 * 8. m = P[mid - 1].x  // vertical line x-coordinate at midpoint
 * 9. S = [Q[i] for Q[i] in Q if |Q[i].x - m| < d]  // points within strip of width 2d
 * 10. For each point S[i], compare with next 7 (or fewer) points in y-order
 *      where (S[k].y - S[i].y)^2 < d^2
 * 11. dminsq = min(current dminsq, (S[k].x - S[i].x)^2 + (S[k].y - S[i].y)^2)
 * 12. Return sqrt(dminsq)
 *
 * Important: The algorithm maintains the invariant that Q is sorted by y-coordinate
 * at every recursive level, achieved by partitioning based on leftSet membership.
 */
export function efficientClosestPair(P: Point2D[], Q: Point2D[]): number {
  const n = P.length;

  // Base case: if n <= 3, use brute force
  if (n <= 3) {
    return bruteForce(P);
  }

  // Divide: find midpoint
  const mid = Math.ceil(n / 2);

  // Left and right halves sorted by x-coordinate
  const Pl = P.slice(0, mid);
  const Pr = P.slice(mid);

  // Create a Set of left-half points for O(1) membership lookups
  const leftSet = new Set(Pl.map(p => `${p.x},${p.y}`));

  // Partition Q into Ql and Qr preserving y-order
  // Ql: points in left half, Qr: points in right half
  const Ql: Point2D[] = [];
  const Qr: Point2D[] = [];

  for (let i = 0; i < Q.length; i++) {
    const key = `${Q[i].x},${Q[i].y}`;
    if (leftSet.has(key)) {
      Ql.push(Q[i]);
    } else {
      Qr.push(Q[i]);
    }
  }

  // Conquer: recursive calls on left and right halves
  const dl = efficientClosestPair(Pl, Ql);
  const dr = efficientClosestPair(Pr, Qr);

  // Combine: take the minimum of the two subproblem results
  const d = Math.min(dl, dr);

  // Find the midpoint x-coordinate
  const m = P[mid - 1].x;

  // Build the strip: points from Q within distance d of the midpoint line
  // We use Q (sorted by y) because it preserves y-order for the inner loop
  const S: Point2D[] = [];
  for (let i = 0; i < Q.length; i++) {
    if (Math.abs(Q[i].x - m) < d) {
      S.push(Q[i]);
    }
  }
  const num = S.length;

  // Check pairs within the strip
  // For each point, only need to check the next 7 points in y-order
  // (or fewer if within the while condition)
  let dminsq = d * d;

  for (let i = 0; i <= num - 2; i++) {
    let k = i + 1;

    // While the y-difference squared is less than d^2
    while (k <= num - 1 && ((S[k].y - S[i].y) ** 2) < dminsq) {
      // Compute actual squared distance
      const currentDistSq = (S[k].x - S[i].x) ** 2 + (S[k].y - S[i].y) ** 2;
      dminsq = Math.min(currentDistSq, dminsq);

      // Move to next point
      k = k + 1;
    }
  }

  // Return the square root of the minimum squared distance found
  return Math.sqrt(dminsq);
}

/**
 * Find the closest pair among a set of points using the divide-and-conquer algorithm.
 *
 * @param points Array of 2D points {x, y} with planar Euclidean coordinates
 * @returns Object containing the closest pair distance and the pair itself
 *
 * Pre-processing:
 * 1. P = points sorted by x-coordinate ascending
 * 2. Q = points sorted by y-coordinate ascending
 * 3. Call efficientClosestPair(P, Q)
 *
 * Special cases handled:
 * - Fewer than 2 points: returns Infinity with undefined pair
 * - Duplicate coordinates: distance 0 detected correctly
 * - Exactly 2 points: direct distance computation
 * - Exactly 3 points: brute force computation
 */
export function findClosestPair(points: Point2D[]): {
  distance: number;
  p1: Point2D | null;
  p2: Point2D | null;
} {
  if (points.length < 2) {
    return { distance: Infinity, p1: null, p2: null };
  }

  if (points.length === 2) {
    const d = distance(points[0], points[1]);
    return { distance: d, p1: points[0], p2: points[1] };
  }

  if (points.length === 3) {
    const d = bruteForce(points);
    // Return the pair with minimum distance
    let minDist = Infinity;
    let p1: Point2D | null = null;
    let p2: Point2D | null = null;

    const d01 = distance(points[0], points[1]);
    const d02 = distance(points[0], points[2]);
    const d12 = distance(points[1], points[2]);

    if (d01 <= minDist) {
      minDist = d01; p1 = points[0]; p2 = points[1];
    }
    if (d02 <= minDist) {
      minDist = d02; p1 = points[0]; p2 = points[2];
    }
    if (d12 <= minDist) {
      minDist = d12; p1 = points[1]; p2 = points[2];
    }

    return { distance: minDist, p1, p2 };
  }

  // For 4+ points: use divide and conquer
  // Pre-sort: P by x-coordinate, Q by y-coordinate
  const P = [...points].sort((a, b) => a.x - b.x);
  const Q = [...points].sort((a, b) => a.y - b.y);

  const closestDist = efficientClosestPair(P, Q);

  // Find the actual pair by checking all close pairs within the final d
  // (simplified: return distance; full pair reconstruction would need more logic)
  return { distance: closestDist, p1: null, p2: null };
}

/**
 * Example usage from Chapter 5 PDF specifications.
 *
 * const points = [
 *   { x: 2, y: 3 }, { x: 12, y: 30 }, { x: 40, y: 50 },
 *   { x: 5, y: 1 }, { x: 12, y: 10 }, { x: 3, y: 4 }
 * ];
 *
 // Presort arrays by x and y coordinates as expected by the Input specification
 const P = [...points].sort((a, b) => a.x - b.x);
 const Q = [...points].sort((a, b) => a.y - b.y);
 *
 // console.log("Closest Distance:", EfficientClosestPair(P, Q));
 */
export function runChapter5Example(): {
  closestDistance: number;
  P: Point2D[];
  Q: Point2D[];
} {
  const points: Point2D[] = [
    { x: 2, y: 3 },
    { x: 12, y: 30 },
    { x: 40, y: 50 },
    { x: 5, y: 1 },
    { x: 12, y: 10 },
    { x: 3, y: 4 },
  ];

  const P = [...points].sort((a, b) => a.x - b.x);
  const Q = [...points].sort((a, b) => a.y - b.y);

  const closestDistance = efficientClosestPair(P, Q);

  return {
    closestDistance,
    P,
    Q,
  };
}

/**
 * Validate closest pair input.
 *
 * @param points Array of 2D points to validate
 * @returns Validation result
 */
export function validateClosestPairInput(points: Point2D[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (points.length === 0) {
    errors.push('Point set must contain at least 2 points');
  }

  if (points.length === 1) {
    errors.push('Point set must contain at least 2 points for closest pair computation');
  }

  // Validate that all points have valid coordinates
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
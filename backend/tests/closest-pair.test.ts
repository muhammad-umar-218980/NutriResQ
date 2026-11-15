import { describe, expect, it } from 'vitest';

import { bruteForceClosestPair } from '../src/algorithms/brute-force-closest-pair';
import { bruteForce, findClosestPair, type Point2D } from '../src/algorithms/closest-pair';
import { createRng } from '../src/algorithms/lib/rng';

const EPSILON = 1e-9;

describe('divide-and-conquer closest pair', () => {
  it('agrees with the brute-force baseline on 200 random point sets', () => {
    const rng = createRng(2026);

    for (let instance = 0; instance < 200; instance++) {
      const size = 2 + Math.floor(rng() * 39);
      const points: Point2D[] = Array.from({ length: size }, () => ({
        x: (rng() - 0.5) * 2000,
        y: (rng() - 0.5) * 2000,
      }));

      const divide = findClosestPair(points);
      const brute = bruteForceClosestPair(points);

      expect(divide.distance).toBeCloseTo(brute.minDistance, 9);
      expect(divide.distance).toBeLessThan(Infinity);
      expect(divide.p1).not.toBeNull();
      expect(divide.p2).not.toBeNull();
    }
  });

  it('matches the in-module brute-force distance helper', () => {
    const points: Point2D[] = [
      { x: 2, y: 3 },
      { x: 12, y: 30 },
      { x: 40, y: 50 },
      { x: 5, y: 1 },
      { x: 12, y: 10 },
      { x: 3, y: 4 },
    ];

    expect(findClosestPair(points).distance).toBeCloseTo(bruteForce(points), 9);
  });

  it('detects duplicate coordinates as distance zero', () => {
    const points: Point2D[] = [
      { x: 10, y: 10 },
      { x: -5, y: 4 },
      { x: 10, y: 10 },
      { x: 100, y: 100 },
    ];

    const result = findClosestPair(points);
    expect(result.distance).toBe(0);
    expect(result.p1).not.toBeNull();
    expect(result.p2).not.toBeNull();
  });

  it('breaks ties deterministically', () => {
    const points = [
      { x: 0, y: 0, id: 'a' },
      { x: 3, y: 4, id: 'b' }, // distance 5 from a
      { x: -3, y: -4, id: 'c' }, // distance 5 from a
      { x: 30, y: 40, id: 'd' },
    ];

    const first = findClosestPair(points);
    const second = findClosestPair(points);

    expect(first.distance).toBe(5);
    expect((first.p1 as { id?: string }).id).toBe((second.p1 as { id?: string }).id);
    expect((first.p2 as { id?: string }).id).toBe((second.p2 as { id?: string }).id);

    // The reported pair must be one of the two distance-5 pairs.
    const pair = [first.p1, first.p2]
      .map((point) => (point as { id?: string }).id)
      .sort()
      .join('');
    expect(['ab', 'ac']).toContain(pair);
  });

  it('handles fewer than two points without throwing', () => {
    expect(findClosestPair([])).toEqual({ distance: Infinity, p1: null, p2: null });
    expect(findClosestPair([{ x: 1, y: 2 }])).toEqual({
      distance: Infinity,
      p1: null,
      p2: null,
    });
  });

  it('handles exactly two and exactly three points', () => {
    const two = findClosestPair([
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ]);
    expect(two.distance).toBe(5);

    const three = findClosestPair([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(three.distance).toBe(1);
  });

  it('counts every pair in the brute-force baseline', () => {
    const points = Array.from({ length: 10 }, (_, index) => ({ x: index, y: index * 2 }));
    const result = bruteForceClosestPair(points);
    expect(result.comparisons).toBe((10 * 9) / 2);
    expect(result.minDistance).toBeCloseTo(Math.sqrt(1 + 4), 9);
  });

  it('is symmetric: the reported pair distance equals |p1 - p2|', () => {
    const rng = createRng(11);
    for (let instance = 0; instance < 50; instance++) {
      const points: Point2D[] = Array.from({ length: 5 + Math.floor(rng() * 20) }, () => ({
        x: (rng() - 0.5) * 100,
        y: (rng() - 0.5) * 100,
      }));

      const result = findClosestPair(points);
      const p1 = result.p1 as Point2D;
      const p2 = result.p2 as Point2D;
      expect(Math.hypot(p1.x - p2.x, p1.y - p2.y)).toBeCloseTo(result.distance, EPSILON);
    }
  });
});

/**
 * Scale benchmark for the CCP performance section.
 *
 * `npm run bench:scale` prints CSV to stdout; nothing is written to the
 * database and no server is started. Every row is a measured runtime on a
 * deterministic synthetic instance, so the numbers are reproducible:
 *
 *   algorithm,instance,size,metric,value,unit,note
 *
 * The note column states what the measurement does and does not prove. ACO is
 * a heuristic: faster is not better, and cost is reported separately by the
 * Algorithms lab and the benchmarks page.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { hostname, platform, arch } from 'node:os';
import path from 'node:path';
import { optimizeRouteWithACO, createDefaultACOConfig } from '../algorithms/aco';
import { aStarSearch } from '../algorithms/astar';
import { dijkstraSearch } from '../algorithms/dijkstra';
import { findClosestPair } from '../algorithms/closest-pair';
import { bruteForceClosestPair } from '../algorithms/brute-force-closest-pair';
import { createRng } from '../algorithms/lib/rng';
import type { RouteJob } from '../algorithms/lib/route';
import { solveMultipleKnapsack, type MultipleKnapsackItem } from '../algorithms/multiple-knapsack-dp';

type Graph = Map<string, Map<string, number>>;

interface Row {
  algorithm: string;
  instance: string;
  size: number | null;
  metric: string;
  value: number | string;
  unit: string;
  note: string;
}

const rows: Row[] = [];

function record(row: Row): void {
  rows.push(row);
}

function time<T>(run: () => T): { value: T; ms: number } {
  const startedAt = performance.now();
  const value = run();
  return { value, ms: performance.now() - startedAt };
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/* --- A* vs Dijkstra on a grid road network -------------------------------- */

/**
 * `size x size` grid of nodes joined to their four neighbours with cost 1.
 * The heuristic is the Euclidean distance on the same grid, which is
 * admissible because every edge costs at least its straight-line length.
 */
function buildGrid(size: number): { graph: Graph; coords: Map<string, { x: number; y: number }> } {
  const graph: Graph = new Map();
  const coords = new Map<string, { x: number; y: number }>();

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const id = `${x},${y}`;
      coords.set(id, { x, y });
      graph.set(id, new Map());
    }
  }

  const connect = (from: string, to: string): void => {
    graph.get(from)!.set(to, 1);
    graph.get(to)!.set(from, 1);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const id = `${x},${y}`;
      if (x + 1 < size) connect(id, `${x + 1},${y}`);
      if (y + 1 < size) connect(id, `${x},${y + 1}`);
    }
  }

  return { graph, coords };
}

function runAstarBenchmark(): void {
  for (const size of [10, 20, 30, 40]) {
    const { graph, coords } = buildGrid(size);
    const nodeCount = size * size;

    const pairs: Array<[string, string]> = [
      ['0,0', `${size - 1},${size - 1}`],
      [`${size - 1},0`, `0,${size - 1}`],
      ['0,0', `${size - 1},0`],
    ];

    const heuristicFor =
      (goal: string) =>
      (nodeId: string | number): number => {
        const goalCoord = coords.get(goal);
        const coord = coords.get(String(nodeId));
        if (!goalCoord || !coord) return 0;
        return Math.hypot(goalCoord.x - coord.x, goalCoord.y - coord.y);
      };

    let astarMs = 0;
    let dijkstraMs = 0;
    let astarExpanded = 0;
    let dijkstraExpanded = 0;
    let costsAgree = true;

    for (const [from, to] of pairs) {
      const astar = time(() => aStarSearch(graph, from, to, heuristicFor(to)));
      const dijkstra = time(() => dijkstraSearch(graph, from, to));

      astarMs += astar.ms;
      dijkstraMs += dijkstra.ms;
      astarExpanded += astar.value.nodesExpanded;
      dijkstraExpanded += dijkstra.value.nodesExpanded;
      const dijkstraCost = dijkstra.value.distances.get(to) ?? Infinity;
      if (astar.value.totalCost !== dijkstraCost) costsAgree = false;
    }

    record({
      algorithm: 'astar',
      instance: `${size}x${size} grid, ${pairs.length} corner pairs`,
      size: nodeCount,
      metric: 'runtime',
      value: round(astarMs, 3),
      unit: 'ms',
      note: 'admissible Euclidean heuristic; compared with Dijkstra on identical pairs',
    });
    record({
      algorithm: 'dijkstra',
      instance: `${size}x${size} grid, ${pairs.length} corner pairs`,
      size: nodeCount,
      metric: 'runtime',
      value: round(dijkstraMs, 3),
      unit: 'ms',
      note: 'baseline for A*; same graph and pairs',
    });
    record({
      algorithm: 'astar',
      instance: `${size}x${size} grid, ${pairs.length} corner pairs`,
      size: nodeCount,
      metric: 'nodes-expanded',
      value: astarExpanded,
      unit: 'nodes',
      note: `Dijkstra expanded ${dijkstraExpanded}; costs agree: ${costsAgree ? 'yes' : 'NO'}`,
    });
  }
}

/* --- Closest pair: divide and conquer vs brute force --------------------- */

function runClosestPairBenchmark(): void {
  const rng = createRng(20261115);

  for (const count of [100, 500, 1000, 2000, 4000]) {
    const points = Array.from({ length: count }, () => ({
      x: rng() * 100_000,
      y: rng() * 100_000,
    }));

    const divide = time(() => findClosestPair(points));
    const brute = time(() => bruteForceClosestPair(points));

    const agrees = Math.abs(divide.value.distance - brute.value.minDistance) < 1e-6;

    record({
      algorithm: 'closest-pair-dc',
      instance: `${count} random projected points`,
      size: count,
      metric: 'runtime',
      value: round(divide.ms, 3),
      unit: 'ms',
      note: `distance agrees with brute force: ${agrees ? 'yes' : 'NO'}`,
    });
    record({
      algorithm: 'closest-pair-brute',
      instance: `${count} random projected points`,
      size: count,
      metric: 'runtime',
      value: round(brute.ms, 3),
      unit: 'ms',
      note: `O(n^2) baseline: ${(count * (count - 1)) / 2} pair comparisons`,
    });
  }
}

/* --- Multiple-knapsack DP ------------------------------------------------- */

function runKnapsackBenchmark(): void {
  const rng = createRng(424242);
  // Same fleet as the seeded scenario: 61 x 46 x 51 = 143,106 DP states.
  const capacities = [60, 45, 50];

  for (const itemCount of [10, 14, 18, 22, 26, 30]) {
    const items: MultipleKnapsackItem[] = Array.from({ length: itemCount }, (_, index) => ({
      id: `pkg-${index}`,
      weightUnits: 1 + Math.floor(rng() * 20),
      value: 1 + Math.floor(rng() * 40),
    }));

    const dp = time(() => solveMultipleKnapsack(items, capacities, { maxStates: 250_000 }));

    record({
      algorithm: 'multiple-knapsack-dp',
      instance: `${itemCount} packages, capacities ${capacities.join('/')}`,
      size: itemCount,
      metric: 'runtime',
      value: round(dp.ms, 3),
      unit: 'ms',
      note: `state count ${dp.value.stateCount}, exact=${dp.value.exact}`,
    });
  }
}

/* --- ACO search time ------------------------------------------------------ */

function runAcoBenchmark(): void {
  const rng = createRng(777);

  for (const jobCount of [4, 6, 8, 10]) {
    // Points on a 100 x 100 plane; cost is Euclidean, so no graph is needed.
    const coords = Array.from({ length: jobCount * 2 + 1 }, () => ({
      x: rng() * 100,
      y: rng() * 100,
    }));
    const cost = (from: string, to: string): number => {
      const a = coords[Number(from.replace('n', ''))];
      const b = coords[Number(to.replace('n', ''))];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
    };
    const jobs: RouteJob[] = Array.from({ length: jobCount }, (_, index) => ({
      id: `job-${index}`,
      pickupLocationId: `n${index * 2 + 1}`,
      deliveryLocationId: `n${index * 2 + 2}`,
    }));
    const config = createDefaultACOConfig(jobs.length, { seed: 2026, numTrials: 20 });

    const aco = time(() => optimizeRouteWithACO('n0', jobs, cost, config));

    record({
      algorithm: 'aco',
      instance: `${jobCount} jobs, ${config.numTrials} trials, ${config.numAnts} ants`,
      size: jobCount,
      metric: 'runtime',
      value: round(aco.ms, 3),
      unit: 'ms',
      note: `heuristic; best tour cost ${round(aco.value.totalCost, 3)} on this synthetic plane`,
    });
  }
}

/* --- Output --------------------------------------------------------------- */

function csvCell(value: number | string | null): string {
  const text = value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

runAstarBenchmark();
runClosestPairBenchmark();
runKnapsackBenchmark();
runAcoBenchmark();

/**
 * `--out <file.ts>` also writes the same rows as a typed module, which the
 * dashboard's scaling chart reads. The runtimes are measured on the machine
 * that ran the script, so the header records where and when.
 */
const outIndex = process.argv.indexOf('--out');
const outPath = outIndex >= 0 ? process.argv[outIndex + 1] : null;

if (!outPath) {
  console.log('algorithm,instance,size,metric,value,unit,note');
  for (const row of rows) {
    console.log(
      [
        row.algorithm,
        row.instance,
        row.size,
        row.metric,
        row.value,
        row.unit,
        row.note,
      ]
        .map(csvCell)
        .join(','),
    );
  }
}

if (outPath) {
  const header = `/**
 * GENERATED FILE - do not edit by hand.
 *
 * Scaling benchmark measured by \`npm run bench:export\`
 * (backend/src/bench/scale.ts). Each row is one deterministic synthetic
 * instance; timings are wall-clock and therefore machine-specific.
 *
 * Machine: ${platform()} ${arch()} / ${hostname()}
 * Generated: ${new Date().toISOString()}
 */

export interface ScaleBenchmarkRow {
  algorithm: string;
  instance: string;
  size: number | null;
  metric: string;
  value: number | string;
  unit: string;
  note: string;
}

export const SCALE_BENCHMARK_ROWS: ScaleBenchmarkRow[] = [
`;

  const body = rows
    .map((row) => `  ${JSON.stringify(row)},`)
    .join('\n');

  const target = path.resolve(process.cwd(), outPath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${header}${body}\n];\n`, 'utf8');
  console.log(`\nwrote ${rows.length} row(s) to ${target}`);
}

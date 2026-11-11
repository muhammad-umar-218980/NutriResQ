/**
 * Algorithm evaluation endpoints.
 *
 * A* is executed directly on the scenario graph. The other three endpoints run
 * the shared integrated pipeline with the requested parameter overrides, then
 * return the relevant algorithm's output and its measured benchmark. Using the
 * same pipeline keeps eligibility, units and cost sources identical to a real
 * optimization run instead of drifting into a second implementation.
 */

import { aStarSearch } from '../algorithms/astar';
import { dijkstraSearch, reconstructDijkstraPath } from '../algorithms/dijkstra';
import { buildHeuristic, buildRoadGraph, projectLocations } from '../algorithms/lib/graph';
import { NotFoundError } from '../errors/app-error';
import { loadScenarioSnapshot } from '../repositories/scenario.repository';
import type {
  AlgorithmConfig,
  BenchmarkRecord,
  ClosestPairResult,
  OptimizationResult,
  ScenarioSnapshot,
} from '../types/domain';
import {
  resolveAlgorithmConfig,
  runOptimization,
  type AlgorithmConfigOverrides,
} from './optimization.service';

async function snapshotOrThrow(scenarioId: string): Promise<ScenarioSnapshot> {
  const snapshot = await loadScenarioSnapshot(scenarioId);
  if (!snapshot) throw new NotFoundError('No scenario matches that id.');
  return snapshot;
}

function benchmarkFor(
  benchmarks: BenchmarkRecord[],
  algorithmName: string,
): BenchmarkRecord | null {
  return benchmarks.find((benchmark) => benchmark.algorithmName === algorithmName) ?? null;
}

export interface AstarEvaluation {
  from: { id: string; name: string };
  to: { id: string; name: string };
  costUnit: string;
  heuristic: 'projected-distance' | 'zero';
  astar: {
    reached: boolean;
    cost: number | null;
    path: string[];
    pathNames: string[];
    nodesExpanded: number;
    runtimeMs: number;
    unreachableReason?: string;
  };
  dijkstra: {
    reached: boolean;
    cost: number | null;
    path: string[];
    pathNames: string[];
    nodesExpanded: number;
    runtimeMs: number;
  };
  note: string;
}

export async function evaluateAstar(input: {
  scenarioId: string;
  fromLocationId: string;
  toLocationId: string;
  heuristic: 'projected-distance' | 'zero';
}): Promise<AstarEvaluation> {
  const snapshot = await snapshotOrThrow(input.scenarioId);

  const locationById = new Map(snapshot.locations.map((location) => [location.id, location]));
  const from = locationById.get(input.fromLocationId);
  const to = locationById.get(input.toLocationId);
  if (!from) throw new NotFoundError('The start location is not part of that scenario.');
  if (!to) throw new NotFoundError('The goal location is not part of that scenario.');

  const graph = buildRoadGraph(snapshot.roads);
  const projected = projectLocations(snapshot.locations);
  const costUnit = snapshot.roads.find((road) => road.costUnit)?.costUnit ?? 'km';
  const baseHeuristic =
    input.heuristic === 'zero'
      ? () => 0
      : buildHeuristic(costUnit, projected, input.toLocationId);
  const heuristic = (nodeId: string | number): number =>
    baseHeuristic(typeof nodeId === 'string' ? nodeId : String(nodeId));

  const astarStartedAt = performance.now();
  const astar = aStarSearch(graph, input.fromLocationId, input.toLocationId, heuristic);
  const astarRuntimeMs = performance.now() - astarStartedAt;

  const dijkstraStartedAt = performance.now();
  const dijkstra = dijkstraSearch(graph, input.fromLocationId, input.toLocationId);
  const dijkstraRuntimeMs = performance.now() - dijkstraStartedAt;

  const dijkstraPath = reconstructDijkstraPath(
    dijkstra.predecessors,
    input.fromLocationId,
    input.toLocationId,
  ) as string[];

  const astarPath = astar.path as string[];
  const astarCost = astar.reached ? astar.totalCost : null;
  const dijkstraCost = Number.isFinite(dijkstra.distances.get(input.toLocationId))
    ? (dijkstra.distances.get(input.toLocationId) as number)
    : null;

  return {
    from: { id: from.id, name: from.name },
    to: { id: to.id, name: to.name },
    costUnit,
    heuristic: input.heuristic,
    astar: {
      reached: astar.reached,
      cost: astarCost,
      path: astarPath,
      pathNames: astarPath.map((id) => locationById.get(id)?.name ?? id),
      nodesExpanded: astar.nodesExpanded,
      runtimeMs: Math.round(astarRuntimeMs * 1000) / 1000,
      ...(astar.unreachableReason ? { unreachableReason: astar.unreachableReason } : {}),
    },
    dijkstra: {
      reached: dijkstraPath.length > 0,
      cost: dijkstraCost,
      path: dijkstraPath,
      pathNames: dijkstraPath.map((id) => locationById.get(id)?.name ?? id),
      nodesExpanded: dijkstra.nodesExpanded,
      runtimeMs: Math.round(dijkstraRuntimeMs * 1000) / 1000,
    },
    note:
      'Costs come from stored road edges in ' +
      `${costUnit}. Closed roads are excluded from the graph. ` +
      (input.heuristic === 'projected-distance'
        ? 'The A* heuristic is straight-line projected distance converted to the cost unit; it is admissible for km road costs.'
        : 'A zero heuristic makes A* expand like Dijkstra; it is always admissible.'),
  };
}

export interface AlgorithmEvaluation<T> {
  result: T;
  benchmark: BenchmarkRecord | null;
  warnings: OptimizationResult['warnings'];
  errors: string[];
  algorithmConfig: AlgorithmConfig;
  note: string;
}

async function runPipeline(
  scenarioId: string,
  overrides: AlgorithmConfigOverrides,
): Promise<ReturnType<typeof runOptimization>> {
  const snapshot = await snapshotOrThrow(scenarioId);
  const config = resolveAlgorithmConfig(overrides);
  return runOptimization({ snapshot, config, runStartedAt: new Date().toISOString() });
}

export async function evaluateKnapsack(input: {
  scenarioId: string;
  maxStates?: number;
}): Promise<
  AlgorithmEvaluation<{
    allocations: OptimizationResult['allocations'];
    unallocated: OptimizationResult['unallocated'];
    metrics: OptimizationResult['metrics'];
    inputCounts: OptimizationResult['inputCounts'];
  }>
> {
  const outcome = await runPipeline(input.scenarioId, {
    knapsack: { maxStates: input.maxStates },
  });
  const { result } = outcome;

  return {
    result: {
      allocations: result.allocations,
      unallocated: result.unallocated,
      metrics: result.metrics,
      inputCounts: result.inputCounts,
    },
    benchmark: benchmarkFor(outcome.benchmarks, 'multiple-knapsack-dp'),
    warnings: result.warnings,
    errors: result.errors,
    algorithmConfig: result.algorithmConfig,
    note:
      'Exact multiple-knapsack DP (value_score * recipient_priority, integer kilogram units), ' +
      'compared with the greedy value-density baseline on identical inputs.',
  };
}

export async function evaluateAco(input: {
  scenarioId: string;
  overrides?: AlgorithmConfigOverrides;
}): Promise<
  AlgorithmEvaluation<{
    routes: OptimizationResult['routes'];
    unreachable: OptimizationResult['unreachable'];
    metrics: OptimizationResult['metrics'];
  }>
> {
  const outcome = await runPipeline(input.scenarioId, input.overrides ?? {});
  const { result } = outcome;

  return {
    result: {
      routes: result.routes,
      unreachable: result.unreachable,
      metrics: result.metrics,
    },
    benchmark: benchmarkFor(outcome.benchmarks, 'aco'),
    warnings: result.warnings,
    errors: result.errors,
    algorithmConfig: result.algorithmConfig,
    note:
      'ACO orders the pickup/delivery jobs derived from the current DP allocation, using A* road ' +
      'costs. It is a heuristic: the nearest-neighbour baseline is measured on the same jobs and ' +
      'a lower ACO cost is an observation for this seed, not a guarantee.',
  };
}

export async function evaluateClosestPair(input: {
  scenarioId: string;
}): Promise<
  AlgorithmEvaluation<{
    closestPair: ClosestPairResult | null;
    locationCount: number;
  }>
> {
  const outcome = await runPipeline(input.scenarioId, {});
  const { result } = outcome;

  return {
    result: {
      closestPair: result.closestPair,
      locationCount: result.inputCounts.locations,
    },
    benchmark: benchmarkFor(outcome.benchmarks, 'divide-and-conquer-closest-pair'),
    warnings: result.warnings,
    errors: result.errors,
    algorithmConfig: result.algorithmConfig,
    note:
      'Closest pair uses straight-line Euclidean distance between projected coordinates ' +
      '(equirectangular metres around the scenario centroid). It is not road distance.',
  };
}

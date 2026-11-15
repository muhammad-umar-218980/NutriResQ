import { describe, expect, it } from 'vitest';

import { aStarSearch } from '../src/algorithms/astar';
import { dijkstraSearch, reconstructDijkstraPath } from '../src/algorithms/dijkstra';
import { buildHeuristic, buildRoadGraph, projectLocations } from '../src/algorithms/lib/graph';
import { buildSeedSnapshot, seedLocationId } from './helpers/seed-snapshot';

const snapshot = buildSeedSnapshot();
const graph = buildRoadGraph(snapshot.roads);
const coords = projectLocations(snapshot.locations);
const isolationId = seedLocationId(10);
const reachableIds = snapshot.locations
  .map((location) => location.id)
  .filter((id) => id !== isolationId);

const goalHeuristics = new Map(
  reachableIds.map((goal) => [goal, buildHeuristic('km', coords, goal)]),
);

describe('A* search on the seed road graph', () => {
  it('never expands a heuristic value above the true remaining cost (admissibility)', () => {
    for (const goal of reachableIds) {
      const heuristic = goalHeuristics.get(goal)!;
      for (const start of reachableIds) {
        const dijkstra = dijkstraSearch(graph, start, goal);
        const trueCost = dijkstra.distances.get(goal) as number;
        expect(Number.isFinite(trueCost)).toBe(true);

        // h(start) is the heuristic at the search's first node.
        expect(heuristic(start), `h(${start}) overestimates d(${start}, ${goal})`).toBeLessThanOrEqual(
          trueCost + 1e-9,
        );
      }
    }
  });

  it('returns the same cost as Dijkstra for every reachable ordered pair', () => {
    let compared = 0;

    for (const goal of reachableIds) {
      const heuristic = goalHeuristics.get(goal)!;
      for (const start of reachableIds) {
        if (start === goal) continue;

        const astar = aStarSearch(graph, start, goal, heuristic);
        const dijkstra = dijkstraSearch(graph, start, goal);
        const dijkstraCost = dijkstra.distances.get(goal) as number;

        expect(astar.reached, `A* failed for ${start} -> ${goal}`).toBe(true);
        expect(astar.totalCost).toBeCloseTo(dijkstraCost, 9);
        compared++;
      }
    }

    expect(compared).toBe(reachableIds.length * (reachableIds.length - 1));
  });

  it('produces a path whose legs exist in the graph and whose costs sum to totalCost', () => {
    for (const goal of reachableIds) {
      const heuristic = goalHeuristics.get(goal)!;
      for (const start of reachableIds) {
        if (start === goal) continue;

        const astar = aStarSearch(graph, start, goal, heuristic);
        const path = astar.path.map(String);
        expect(path[0]).toBe(start);
        expect(path[path.length - 1]).toBe(goal);

        let summed = 0;
        for (let index = 0; index < path.length - 1; index++) {
          const edgeCost = graph.get(path[index])?.get(path[index + 1]);
          expect(edgeCost, `missing graph edge ${path[index]} -> ${path[index + 1]}`).toBeDefined();
          summed += edgeCost as number;
        }
        expect(summed).toBeCloseTo(astar.totalCost, 9);
      }
    }
  });

  it('reports the isolated location as unreachable instead of inventing a path', () => {
    const fromDepot = aStarSearch(
      graph,
      seedLocationId(1),
      isolationId,
      buildHeuristic('km', coords, isolationId),
    );

    expect(fromDepot.reached).toBe(false);
    expect(fromDepot.path).toEqual([]);
    expect(fromDepot.totalCost).toBe(Infinity);
    expect(fromDepot.unreachableReason).toMatch(/no path|unreachable|not found/i);

    const fromIsolation = aStarSearch(
      graph,
      isolationId,
      seedLocationId(1),
      buildHeuristic('km', coords, seedLocationId(1)),
    );
    expect(fromIsolation.reached).toBe(false);
  });

  it('never uses the closed road', () => {
    const closedRoad = snapshot.roads.find((road) => !road.isAvailable)!;
    expect(closedRoad).toBeDefined();

    for (const goal of reachableIds) {
      const heuristic = goalHeuristics.get(goal)!;
      for (const start of reachableIds) {
        if (start === goal) continue;
        const astar = aStarSearch(graph, start, goal, heuristic);
        const path = astar.path.map(String);
        for (let index = 0; index < path.length - 1; index++) {
          const usesClosed =
            (path[index] === closedRoad.fromLocationId && path[index + 1] === closedRoad.toLocationId) ||
            (path[index] === closedRoad.toLocationId && path[index + 1] === closedRoad.fromLocationId);
          expect(usesClosed, `A* used the closed road for ${start} -> ${goal}`).toBe(false);
        }
      }
    }
  });

  it('matches Dijkstra exactly when the heuristic is zero', () => {
    const start = seedLocationId(1);
    const goal = seedLocationId(8);

    const astar = aStarSearch(graph, start, goal, () => 0);
    const dijkstra = dijkstraSearch(graph, start, goal);

    expect(astar.totalCost).toBeCloseTo(dijkstra.distances.get(goal) as number, 9);
    expect(astar.path.map(String)).toEqual(
      reconstructDijkstraPath(dijkstra.predecessors, start, goal).map(String),
    );
  });

  it('falls back to a zero heuristic when the cost unit is not km', () => {
    const heuristic = buildHeuristic('minutes', coords, seedLocationId(8));
    for (const id of reachableIds) {
      expect(heuristic(id)).toBe(0);
    }
  });

  it('expands no more nodes than Dijkstra with the admissible heuristic', () => {
    const start = seedLocationId(1);
    const goal = seedLocationId(23);

    const astar = aStarSearch(graph, start, goal, goalHeuristics.get(goal)!);
    const dijkstra = dijkstraSearch(graph, start, goal);

    expect(astar.reached).toBe(true);
    expect(astar.nodesExpanded).toBeLessThanOrEqual(dijkstra.nodesExpanded);
  });
});

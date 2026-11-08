/* Import AstarResult from astar module */
import { AstarResult } from './astar';

/**
 * Dijkstra's Algorithm - Baseline for A* Search Comparison.
 *
 * Finds shortest path from start node to all other nodes (or to a specific goal)
 * in a weighted graph with non-negative edge costs.
 *
 * Key differences from A*:
 * - Uses zero heuristic (h(n) = 0) for all nodes
 * - Expands nodes based on distance from start only (not f(n) = g(n) + h(n))
 * - Guarantees shortest path but may expand more nodes than A* with good heuristic
 * - Admissible heuristic claim for A* is not made; Dijkstra is optimal for cost-only search
 *
 * Graph format: Map<fromNodeId, Map<toNodeId, cost>> with non-negative costs
 * Return: shortest distance and path from start to goal, or distances to all nodes
 */
export interface DijkstraNode {
  id: string | number;
  /** Neighbors with edge costs: Map<neighborId, cost> */
  neighbors: Map<string | number, number>;
}

/**
 * Result of Dijkstra search from a start node.
 */
export interface DijkstraResult {
  /** Shortest distance from start to each node */
  distances: Map<string | number, number>;
  /** Predecessor map for path reconstruction: nodeId -> previous nodeId on shortest path */
  predecessors: Map<string | number, string | number | null>;
  /** Whether each node was reached/reached from start */
  reached: Map<string | number, boolean>;
  /** Number of nodes processed/expanded during search */
  nodesExpanded: number;
  /** Start node id */
  startId: string | number;
  /** Goal node id (if searching to a specific goal), null if searching to all nodes */
  goalId: string | number | null;
}

/**
 * Run Dijkstra's algorithm from a start node.
 *
 * @param graph Adjacency list representation of the road network.
 *              Map<fromId, Map<toId, cost>> where cost >= 0.
 * @param startId The id of the starting node.
 * @param goalId Optional target node id. If provided, stops when goal is reached.
 *                If not provided, computes shortest distances to all reachable nodes.
 * @returns DijkstraResult containing shortest distances, predecessors, and diagnostics.
 *
 * Algorithm:
 * 1. Initialize distance to start = 0, all others = Infinity
 * 2. Use a priority queue (min-heap) keyed by tentative distance
 * 3. Extract node with minimum distance from queue
 * 4. For each unvisited neighbor, relax edge: if dist[current] + cost < dist[neighbor],
 *    update dist[neighbor] and set predecessor[neighbor] = current
 * 5. Mark current as visited
 * 6. Repeat until queue is empty or goal is reached (if specified)
 *
 * Constraints:
 * - All edge costs must be non-negative (no negative weight edges)
 * - Graph may be directed or undirected (caller builds graph accordingly)
 * - Closed/unavailable roads should be excluded from the graph before calling
 */
export function dijkstraSearch(
  graph: Map<string | number, Map<string | number, number>>,
  startId: string | number,
  goalId?: string | number
): DijkstraResult {
  // Initialize distances to Infinity, start to 0
  const distances = new Map<string | number, number>();
  const predecessors = new Map<string | number, string | number | null>();
  const reached = new Map<string | number, boolean>();
  const visited = new Set<string | number>();

  // Set up initial distances
  // We need to know all nodes; collect them from the graph
  const allNodes = new Set<string | number>();

  // Collect all nodes from graph keys and neighbor keys
  for (const [from, neighbors] of graph.entries()) {
    allNodes.add(from);
    for (const [to, cost] of neighbors.entries()) {
      allNodes.add(to);
    }
  }

  // Initialize distances and predecessors
  for (const node of allNodes) {
    distances.set(node, Infinity);
    predecessors.set(node, null);
  }
  distances.set(startId, 0);

  // Priority queue: [distance, nodeId]
  // Using simple array sort-based approach without external deps
  const pq: Array<[number, string | number]> = [[0, startId]];

  let nodesExpanded = 0;

  while (pq.length > 0) {
    // Sort and pick the entry with smallest distance
    pq.sort((a, b) => a[0] - b[0]);
    const [dist, current] = pq.shift()!;

    // If we already visited this node with a better distance, skip
    if (visited.has(current)) continue;
    if (dist > distances.get(current)!) continue;

    visited.add(current);
    reached.set(current, true);
    nodesExpanded++;

    // If goal is found, we can stop early
    if (goalId && current === goalId) {
      break;
    }

    // Explore neighbors
    const neighbors = graph.get(current) || new Map();
    for (const [neighbor, edgeCost] of neighbors.entries()) {
      if (visited.has(neighbor)) continue;

      const tentativeDist = dist + edgeCost;

      if (tentativeDist < distances.get(neighbor)!) {
        distances.set(neighbor, tentativeDist);
        predecessors.set(neighbor, current);
        pq.push([tentativeDist, neighbor]);
      }
    }
  }

  // Build result
  const resultGoalId = goalId !== undefined ? goalId : startId;
  const resultDistances = new Map<string | number, number>();
  const resultPredecessors = new Map<string | number, string | number | null>();

  // Only include reachable nodes in the result
  for (const node of allNodes) {
      const dist = distances.get(node);
      const pred = predecessors.get(node);
      resultDistances.set(node, dist ?? Infinity);
      resultPredecessors.set(node, pred ?? null);
      reached.set(node, dist !== Infinity && dist !== undefined);
    }

  return {
    distances: resultDistances,
    predecessors: resultPredecessors,
    reached,
    nodesExpanded,
    startId,
    goalId: resultGoalId,
  };
}

/**
 * Reconstruct the path from start to goal using the predecessor map.
 *
 * @param predecessors Map from nodeId -> previous nodeId on shortest path
 * @param startId The starting node id
 * @param goalId The goal node id
 * @returns Array of node ids from start to goal, or empty array if no path exists
 *
 * Path reconstruction:
 * 1. Start at goalId
 * 2. Follow predecessors backwards until reaching startId (or null)
 * 3. Reverse the collected path to get start->goal order
 * 4. If goal is unreachable (predecessor chain leads to null before start), return empty array
 */
export function reconstructDijkstraPath(
  predecessors: Map<string | number, string | number | null>,
  startId: string | number,
  goalId: string | number
): (string | number)[] {
  const path: (string | number)[] = [];
  let current: string | number | null = goalId;

  // Trace back from goal to start
  while (current !== null && current !== startId) {
    path.unshift(current);
    current = predecessors.get(current) ?? null;
  }

  // If we couldn't trace back to start, no path exists
  if (current !== startId) {
    return [];
  }

  // Add the start node
  path.unshift(startId);

  return path;
}

/**
 * Compute shortest distances from start to all nodes using Dijkstra.
 * Convenience function that returns just the distance map.
 *
 * @param graph Adjacency list graph
 * @param startId Starting node id
 * @returns Map<nodeId, shortestDistance> with Infinity for unreachable nodes
 */
export function dijkstraDistances(
  graph: Map<string | number, Map<string | number, number>>,
  startId: string | number
): Map<string | number, number> {
  const result = dijkstraSearch(graph, startId);
  return result.distances;
}

/**
 * Compare Dijkstra and A* on the same graph inputs.
 * Returns both results so the caller can compare nodesExpanded and runtime.
 *
 * @param graph Road network graph
 * @param startId Start node
 * @param goalId Goal node
 * @param heuristic Heuristic function for A* (h(n) = 0 gives Dijkstra-like behavior)
 * @returns Object with both Dijkstra and A* results for comparison
 */
export function compareDijkstraAStar(
  graph: Map<string | number, Map<string | number, number>>,
  startId: string | number,
  goalId: string | number,
  heuristic: (nodeId: string | number) => number
) {
  const dijkstraResult = dijkstraSearch(graph, startId, goalId);
  const astarResult = efficientAStarSearch(graph, startId, goalId, heuristic);

  return {
    dijkstra: {
      distance: dijkstraResult.distances.get(goalId) ?? Infinity,
      nodesExpanded: dijkstraResult.nodesExpanded,
      path: reconstructDijkstraPath(
        dijkstraResult.predecessors,
        startId,
        goalId
      ),
    },
    astar: {
      totalCost: astarResult.totalCost,
      path: astarResult.path,
      nodesExpanded: astarResult.nodesExpanded,
      reached: astarResult.reached,
    },
    comparison: {
      dijkstraFewerExpansions:
        dijkstraResult.nodesExpanded <= astarResult.nodesExpanded,
      astarOptimalWhenHeuristicAdmissible:
        heuristic(startId) === 0
          ? 'Dijkstra and A* with zero heuristic are identical'
          : 'A* with admissible heuristic may expand fewer nodes',
    },
  };
}

/**
 * Efficient A* search using the same graph structure as dijkstra.
 * This ensures fair comparison between the two algorithms.
 *
 * @param graph Road network graph
 * @param startId Start node
 * @param goalId Goal node
 * @param heuristic Heuristic function h(n)
 * @returns AstarResult
 */
function efficientAStarSearch(
  graph: Map<string | number, Map<string | number, number>>,
  startId: string | number,
  goalId: string | number,
  heuristic: (nodeId: string | number) => number
): AstarResult {
  // Reuse the same priority queue logic as the main A* but with our types
  const openSet: Array<[number, number, string | number, (string | number)[]]> =
    [[heuristic(startId), 0, startId, [startId]]];

  const closedSet = new Set<string | number>();
  const gScore = new Map<string | number, number>();
  gScore.set(startId, 0);

  let bestPath: (string | number)[] = [];
  let bestCost = Infinity;
  let nodesExpanded = 0;

  const allNodes = new Set<string | number>();
  for (const [from, neighbors] of graph.entries()) {
    allNodes.add(from);
    for (const [to, cost] of neighbors.entries()) {
      allNodes.add(to);
    }
  }

  while (openSet.length > 0) {
    openSet.sort((a, b) => a[0] - b[0]);
    const [f, g, current, path] = openSet.shift()!;

    if (closedSet.has(current)) continue;
    closedSet.add(current);
    nodesExpanded++;

    if (current === goalId) {
      bestPath = path;
      bestCost = g;
      nodesExpanded = closedSet.size;
      break;
    }

    const neighbors = graph.get(current) || new Map();
    for (const [neighbor, edgeCost] of neighbors.entries()) {
      if (closedSet.has(neighbor)) continue;

      const tentativeG = g + edgeCost;
      const existingG = gScore.get(neighbor);

      if (tentativeG < (existingG ?? Infinity)) {
        gScore.set(neighbor, tentativeG);
        const newPath = [...path, neighbor];
        openSet.push([tentativeG + heuristic(neighbor), tentativeG, neighbor, newPath]);
      }
    }
  }

  if (bestCost === Infinity) {
    return {
      path: [],
      totalCost: Infinity,
      nodesExpanded,
      reached: false,
      unreachableReason: 'No path exists through available roads; goal is disconnected from start.',
    };
  }

  return {
    path: bestPath,
    totalCost: bestCost,
    nodesExpanded,
    reached: true,
  };
}
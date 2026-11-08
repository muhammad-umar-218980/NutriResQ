/**
 * A* Search algorithm for road network pathfinding.
 *
 * Input: explicit road graph, start node, goal node, edge costs, heuristic.
 * Closed roads are excluded from the graph used for a run.
 * Heuristic must be admissible for the cost model if optimal-path claims are made;
 * otherwise use a zero heuristic or qualify the claim.
 * Return path, total cost, visited/expanded-node diagnostics where useful,
 * and an explicit unreachable result.
 *
 * Graph format: Map<nodeId, Map<neighborId, cost>>
 * Heuristic function: (nodeId: string | number) => number
 */
export interface AstarNode {
  id: string | number;
  x?: number; // optional coordinate for heuristic
  y?: number; // optional coordinate for heuristic
}

export interface AstarEdge {
  from: string | number;
  to: string | number;
  cost: number;
}

export interface AstarResult {
  /** Sequence of node ids from start to goal, inclusive. Empty if unreachable. */
  path: (string | number)[];
  /** Total cost of the path. Infinity if unreachable. */
  totalCost: number;
  /** Number of nodes expanded during search. */
  nodesExpanded: number;
  /** Whether the goal was reached. */
  reached: boolean;
  /** If unreachable, a human-readable reason. */
  unreachableReason?: string;
}

/**
 * Run A* search on a road graph.
 *
 * @param graph Adjacency list: Map<from, Map<to, cost>> representing available roads.
 *              Roads with isAvailable===false should be excluded before calling.
 * @param startId The id of the starting node.
 * @param goalId The id of the goal node.
 * @param heuristic Heuristic function h(n) estimating cost from n to goal.
 *                  Use a consistent admissible heuristic for optimal paths,
 *                  or a zero heuristic (h(n)=0) for Dijkstra-like behavior.
 * @returns AstarResult containing the path, cost, and diagnostics.
 */
export function aStarSearch(
  graph: Map<string | number, Map<string | number, number>>,
  startId: string | number,
  goalId: string | number,
  heuristic: (nodeId: string | number) => number
): AstarResult {
  const openSet: Array<[number, number, string | number, (string | number)[]]> =
    [[heuristic(startId), 0, startId, [startId]]];

  const closedSet = new Set<string | number>();
  const gScore = new Map<string | number, number>();
  gScore.set(startId, 0);

  let bestPath: (string | number)[] = [];
  let bestCost = Infinity;
  let nodesExpanded = 0;

  while (openSet.length > 0) {
    openSet.sort((a, b) => a[0] - b[0]);
    const [f, g, current, path] = openSet.shift()!;

    if (current === goalId) {
      bestPath = path;
      bestCost = g;
      nodesExpanded = closedSet.size;
      break;
    }

    if (closedSet.has(current)) continue;
    closedSet.add(current);
    nodesExpanded++;

    const neighbors = graph.get(current) || new Map();
    for (const [neighbor, edgeCost] of neighbors) {
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

export default aStarSearch;
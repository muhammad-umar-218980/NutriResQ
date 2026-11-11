import type { LocationRecord, RoadRecord } from '../../types/domain';

export type RoadGraph = Map<string, Map<string, number>>;

/**
 * Build the directed adjacency list used by A* / Dijkstra.
 * Closed roads are excluded. Bidirectional roads add a reverse edge
 * only when no explicit reverse edge already exists.
 */
export function buildRoadGraph(roads: RoadRecord[]): RoadGraph {
  const graph: RoadGraph = new Map();
  for (const road of roads) {
    if (!road.isAvailable) continue;
    if (!Number.isFinite(road.cost) || road.cost < 0) continue;
    if (!road.fromLocationId || !road.toLocationId) continue;

    if (!graph.has(road.fromLocationId)) graph.set(road.fromLocationId, new Map());
    if (!graph.has(road.toLocationId)) graph.set(road.toLocationId, new Map());
    graph.get(road.fromLocationId)!.set(road.toLocationId, road.cost);

    if (road.isBidirectional && !graph.get(road.toLocationId)!.has(road.fromLocationId)) {
      graph.get(road.toLocationId)!.set(road.fromLocationId, road.cost);
    }
  }
  return graph;
}

/**
 * Project lat/lon to local meters using an equirectangular approximation
 * around the scenario centroid. This is a documented local projection used
 * for the closest-pair algorithm and the A* heuristic; it is NOT road distance.
 */
export function projectLocations(locations: LocationRecord[]): Map<string, { x: number; y: number }> {
  const projected = new Map<string, { x: number; y: number }>();
  if (locations.length === 0) return projected;

  const meanLat = locations.reduce((s, l) => s + l.latitude, 0) / locations.length;
  const latRad = (meanLat * Math.PI) / 180;
  const metersPerDegLat = 111_320;
  const metersPerDegLon = 111_320 * Math.cos(latRad);
  const originLat = meanLat;
  const originLon = locations.reduce((s, l) => s + l.longitude, 0) / locations.length;

  for (const loc of locations) {
    projected.set(loc.id, {
      x: (loc.longitude - originLon) * metersPerDegLon,
      y: (loc.latitude - originLat) * metersPerDegLat,
    });
  }
  return projected;
}

/**
 * Admissible heuristic for A* when road costs are kilometres:
 * straight-line distance (km) <= road path distance (km).
 * For any other cost unit the safe heuristic is zero.
 */
export function buildHeuristic(
  costUnit: string,
  coords: Map<string, { x: number; y: number }>,
  goalId: string,
): (nodeId: string) => number {
  const normalized = costUnit.trim().toLowerCase();
  const isKm = normalized === 'km' || normalized === 'kilometre' || normalized === 'kilometer';
  if (!isKm) return () => 0;

  const goal = coords.get(goalId);
  if (!goal) return () => 0;

  return (nodeId: string) => {
    const p = coords.get(nodeId);
    if (!p) return 0;
    return Math.hypot(p.x - goal.x, p.y - goal.y) / 1000;
  };
}

export function reconstructPath(predecessor: Map<string, string | null>, startId: string, goalId: string): string[] {
  const path: string[] = [];
  let current: string | null = goalId;
  const guard = new Set<string>();
  while (current !== null) {
    if (guard.has(current)) return [];
    guard.add(current);
    path.push(current);
    if (current === startId) break;
    current = predecessor.get(current) ?? null;
  }
  if (path[path.length - 1] !== startId) return [];
  return path.reverse();
}

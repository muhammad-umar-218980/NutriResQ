/**
 * Ant Colony Optimization (ACO) for Multi-Stop Route Ordering.
 *
 * As specified in ARCHITECTURE.md FR-27 to FR-33 and TECH_STACK.md:
 * - ACO searches for a low-cost ordering of a defined stop set
 * - Pairwise costs must represent feasible road travel, ideally obtained through A*
 * - Define how unreachable stop pairs affect route construction
 * - Make parameters configurable in a controlled way; record parameters and random seed
 * - Include a nearest-neighbor baseline for comparison (FR-32)
 * - Support fixed seeds and repeated trials where practical; display trial settings (FR-33)
 * - Report measured outcomes; do not promise a fixed percentage improvement (FR-33)
 * - Label ACO output as a heuristic result, not a guaranteed global optimum (FR-31)
 *
 * Key design decisions (must be documented per ARCHITECTURE.md §9):
 * - Coordinate projection and distance units for road costs
 * - Integer scaling and limits for DP (analogous: ACO parameter limits)
 * - ACO parameter defaults and random seed policy
 * - How disconnected/unreachable stop pairs are handled
 *
 * Graph format: Map<nodeId, Map<neighborId, cost>> from A* road network
 * Stop mapping: Array of stop objects with location_id, stop_type (pickup/delivery), etc.
 */
export interface ACORouteStop {
  /** Unique stop identifier (could be location_id or node id) */
  id: string | number;
  /** Coordinate or location for cost computation */
  locationId: string | number;
  /** Stop type: 'start', 'pickup', 'delivery', or 'other' */
  stopType?: string;
  /** Optional: related donation/recipient id */
  relatedId?: string | number;
  /** Optional: coordinate x for distance-based heuristics */
  x?: number;
  /** Optional: coordinate y for distance-based heuristics */
  y?: number;
}

/* Import nearestNeighborRoute from nearest-neighbor module */
import { nearestNeighborRoute } from './nearest-neighbor';

/* ACO config creator function */
export function createDefaultACOConfig(n: number, overrides?: Partial<ACOConfig>): ACOConfig {
  return {
    numAnts: Math.max(1, Math.ceil(Math.sqrt(n))),
    numTrials: 20,
    evaporationRate: 0.5,
    alpha: 1,
    beta: 2,
    Q: 1,
    seed: -1,
    useBestAnt: true,
    ...overrides,
  };
}

/**
 * Run Ant Colony Optimization for route ordering.
 * (Full implementation continues below...)
 */
export interface ACOConfig {
  numAnts: number;
  numTrials: number;
  evaporationRate: number;
  alpha: number;
  beta: number;
  Q: number;
  seed: number;
  useBestAnt: boolean;
}

/**
 * Validate ACO configuration parameters.
 */
export function validateACOConfig(config: Partial<ACOConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.numAnts !== undefined && config.numAnts < 1) {
    errors.push('numAnts must be >= 1');
  }
  if (config.numTrials !== undefined && config.numTrials < 1) {
    errors.push('numTrials must be >= 1');
  }
  if (config.evaporationRate !== undefined && (config.evaporationRate <= 0 || config.evaporationRate >= 1)) {
    errors.push('evaporationRate must be in (0, 1)');
  }
  if (config.alpha !== undefined && config.alpha < 0) {
    errors.push('alpha must be >= 0');
  }
  if (config.beta !== undefined && config.beta < 0) {
    errors.push('beta must be >= 0');
  }
  if (config.seed !== undefined && config.seed < -1) {
    errors.push('seed must be >= -1 (use -1 for random seed)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
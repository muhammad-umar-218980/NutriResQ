/**
 * Mirrored API contracts for the optimization domain. Keep in sync with
 * `backend/src/types/domain.ts`; every number shown in the UI comes from these
 * API results.
 */

export type LocationType = 'donor' | 'recipient' | 'hub' | 'other'

export interface LocationRecord {
  id: string
  name: string
  locationType: LocationType
  latitude: number
  longitude: number
  projectedX: number
  projectedY: number
}

export interface RoadRecord {
  id: string
  scenarioId: string
  fromLocationId: string
  toLocationId: string
  cost: number
  costUnit: string
  isAvailable: boolean
  isBidirectional: boolean
}

export interface DonorRecord {
  id: string
  scenarioId: string
  locationId: string
  name: string
  donorType: string | null
  isActive: boolean
}

export interface RecipientRecord {
  id: string
  scenarioId: string
  locationId: string
  name: string
  recipientType: string | null
  demandUnits: number
  priorityScore: number
  isAvailable: boolean
}

export type DonationStatus = 'available' | 'expired' | 'reserved' | 'unavailable'

export interface DonationRecord {
  id: string
  scenarioId: string
  donorId: string
  packageName: string
  weightUnits: number
  valueScore: number
  recipientId: string | null
  availableAt: string | null
  expiresAt: string | null
  isEligible: boolean
  status: DonationStatus
  donorLocationId: string | null
  recipientLocationId: string | null
  recipientPriority: number
}

export interface VehicleRecord {
  id: string
  scenarioId: string
  name: string
  capacityUnits: number
  startLocationId: string | null
  isAvailable: boolean
}

export interface ScenarioSnapshot {
  scenarioId: string
  scenarioName: string
  capturedAt: string
  locations: LocationRecord[]
  roads: RoadRecord[]
  donors: DonorRecord[]
  recipients: RecipientRecord[]
  donations: DonationRecord[]
  vehicles: VehicleRecord[]
}

export interface ScenarioSummary {
  id: string
  name: string
  description: string | null
  status: 'draft' | 'ready' | 'archived'
  parentScenarioId: string | null
  createdAt: string
  updatedAt: string
  counts: {
    locations: number
    roads: number
    donations: number
    vehicles: number
    runs: number
  }
}

export interface AlgorithmConfig {
  astarHeuristic: 'projected-distance' | 'zero'
  knapsack: {
    valueFormula: 'value_score * recipient_priority'
    maxStates: number
  }
  aco: {
    numAnts: number
    numTrials: number
    evaporationRate: number
    alpha: number
    beta: number
    seed: number
  }
  closestPair: {
    projection: 'equirectangular-meters'
    units: 'meters'
  }
  algorithmVersion: string
}

export interface UnallocatedPackage {
  donationId: string
  packageName: string
  weightUnits: number
  valueScore: number
  reason:
    | 'ineligible'
    | 'expired'
    | 'not_available'
    | 'oversized'
    | 'insufficient_capacity'
    | 'no_vehicle'
    | 'state_limit_exceeded'
  detail: string
}

export interface Allocation {
  vehicleId: string
  donationIds: string[]
  totalWeightUnits: number
  totalValue: number
  capacityUnits: number
  utilization: number
}

export interface RouteLeg {
  fromLocationId: string
  toLocationId: string
  cost: number
  path: string[]
}

export interface RouteStop {
  sequenceNumber: number
  locationId: string
  stopType: 'start' | 'pickup' | 'delivery'
  relatedDonationId: string | null
  relatedRecipientId: string | null
  legCostFromPrevious: number | null
  legPath: string[]
}

export interface VehicleRoute {
  vehicleId: string
  status: 'complete' | 'partial' | 'infeasible' | 'not_required'
  totalCost: number
  costUnit: string
  stops: RouteStop[]
  legs: RouteLeg[]
  algorithmName: 'aco' | 'nearest-neighbor' | 'none'
  algorithmConfig: Record<string, unknown>
  infeasibleReason?: string
}

export interface UnreachablePair {
  fromLocationId: string
  toLocationId: string
  fromName: string
  toName: string
  reason: string
}

export interface ClosestPairResult {
  distanceMeters: number | null
  p1: { id: string; name: string } | null
  p2: { id: string; name: string } | null
  coordinateSystem: 'equirectangular-meters'
  units: 'meters'
  note: string
}

export interface Warning {
  code: string
  message: string
  entityType?: string
  entityId?: string
}

export interface Metrics {
  allocatedPackageValue: number
  allocatedPackageWeightUnits: number
  unallocatedPackageCount: number
  vehicleCapacityUtilization: number
  totalRoadCost: number
  totalRoadCostUnit: string
  reachablePairCount: number
  unreachablePairCount: number
  routeCount: number
  partialRouteCount: number
  runtimeMs: number
}

export interface OptimizationResult {
  status: 'succeeded' | 'partial' | 'failed'
  metrics: Metrics
  allocations: Allocation[]
  unallocated: UnallocatedPackage[]
  routes: VehicleRoute[]
  unreachable: UnreachablePair[]
  closestPair: ClosestPairResult | null
  warnings: Warning[]
  errors: string[]
  algorithmConfig: AlgorithmConfig
  inputCounts: {
    locations: number
    roads: number
    availableRoads: number
    donations: number
    eligibleDonations: number
    vehicles: number
    availableVehicles: number
  }
}

export interface BenchmarkRecord {
  algorithmName: string
  baselineName: string | null
  configuration: Record<string, unknown>
  resultSummary: Record<string, unknown>
  runtimeMs: number
  trialNumber: number
}

export type RunStatus = 'running' | 'succeeded' | 'partial' | 'failed'

export interface RunSummary {
  id: string
  scenarioId: string
  scenarioName: string | null
  parentRunId: string | null
  runBy: string | null
  status: RunStatus
  algorithmConfig: AlgorithmConfig
  metrics: Metrics | null
  warnings: Warning[]
  inputCounts: OptimizationResult['inputCounts'] | null
  errorCode: string | null
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
  createdAt: string
}

export interface RunDetail extends RunSummary {
  result: OptimizationResult | null
  benchmarks: BenchmarkRecord[]
}

export interface ScenariosResponse {
  success: boolean
  scenarios: ScenarioSummary[]
}

export interface ScenarioResponse {
  success: boolean
  scenario: ScenarioSummary
}

export interface SnapshotResponse {
  success: boolean
  snapshot: ScenarioSnapshot
}

export interface RunsResponse {
  success: boolean
  runs: RunSummary[]
  total: number
  page: number
  pageSize: number
}

export interface RunResponse {
  success: boolean
  run: RunDetail
}

export interface AstarEvaluation {
  from: { id: string; name: string }
  to: { id: string; name: string }
  costUnit: string
  heuristic: 'projected-distance' | 'zero'
  astar: {
    reached: boolean
    cost: number | null
    path: string[]
    pathNames: string[]
    nodesExpanded: number
    runtimeMs: number
    unreachableReason?: string
  }
  dijkstra: {
    reached: boolean
    cost: number | null
    path: string[]
    pathNames: string[]
    nodesExpanded: number
    runtimeMs: number
  }
  note: string
}

export interface AlgorithmEvaluation<T> {
  result: T
  benchmark: BenchmarkRecord | null
  warnings: Warning[]
  errors: string[]
  algorithmConfig: AlgorithmConfig
  note: string
}

export interface KnapsackEvaluationResult {
  allocations: Allocation[]
  unallocated: UnallocatedPackage[]
  metrics: Metrics
  inputCounts: OptimizationResult['inputCounts']
}

export interface AcoEvaluationResult {
  routes: VehicleRoute[]
  unreachable: UnreachablePair[]
  metrics: Metrics
}

export interface ClosestPairEvaluationResult {
  closestPair: ClosestPairResult | null
  locationCount: number
}

export interface EvaluationResponse<T> {
  success: boolean
  evaluation: AlgorithmEvaluation<T>
}

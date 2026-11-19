/** Typed calls for the optimization domain endpoints (admin workspace). */

import { apiRequest } from './api'
import type {
  AcoEvaluationResult,
  AstarEvaluation,
  CloneScenarioResponse,
  ClosestPairEvaluationResult,
  ComparisonResponse,
  DonationMutationResponse,
  DonationRecord,
  EvaluationResponse,
  KnapsackEvaluationResult,
  RecipientMutationResponse,
  RoadMutationResponse,
  RunResponse,
  RunsResponse,
  ScenarioChangesResponse,
  ScenariosResponse,
  SensitivityResponse,
  SnapshotResponse,
  SupplyReduceResponse,
  VehicleMutationResponse,
} from '../types/domain'

export interface AlgorithmOverrides {
  astarHeuristic?: 'projected-distance' | 'zero'
  knapsack?: { maxStates?: number }
  aco?: {
    numAnts?: number
    numTrials?: number
    evaporationRate?: number
    alpha?: number
    beta?: number
    seed?: number
  }
}

export function getScenarios(): Promise<ScenariosResponse> {
  return apiRequest<ScenariosResponse>('/api/scenarios')
}

export function getScenarioSnapshot(scenarioId: string): Promise<SnapshotResponse> {
  return apiRequest<SnapshotResponse>(`/api/scenarios/${encodeURIComponent(scenarioId)}/snapshot`)
}

export function getScenarioRuns(
  scenarioId: string,
  page = 1,
  pageSize = 10,
): Promise<RunsResponse> {
  return apiRequest<RunsResponse>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/runs?page=${page}&pageSize=${pageSize}`,
  )
}

export function startOptimization(
  scenarioId: string,
  overrides: AlgorithmOverrides,
): Promise<RunResponse> {
  return apiRequest<RunResponse>('/api/optimize', {
    method: 'POST',
    body: { scenarioId, overrides },
  })
}

export function getRun(runId: string): Promise<RunResponse> {
  return apiRequest<RunResponse>(`/api/runs/${encodeURIComponent(runId)}`)
}

export function evaluateAstar(input: {
  scenarioId: string
  fromLocationId: string
  toLocationId: string
  heuristic: 'projected-distance' | 'zero'
}): Promise<{ success: boolean; evaluation: AstarEvaluation }> {
  return apiRequest<{ success: boolean; evaluation: AstarEvaluation }>('/api/algorithms/astar', {
    method: 'POST',
    body: input,
  })
}

export function evaluateKnapsack(input: {
  scenarioId: string
  maxStates?: number
  verifyOptimality?: boolean
}): Promise<EvaluationResponse<KnapsackEvaluationResult>> {
  return apiRequest<EvaluationResponse<KnapsackEvaluationResult>>(
    '/api/algorithms/knapsack',
    { method: 'POST', body: input },
  )
}

export function evaluateClosestPair(input: {
  scenarioId: string
}): Promise<EvaluationResponse<ClosestPairEvaluationResult>> {
  return apiRequest<EvaluationResponse<ClosestPairEvaluationResult>>(
    '/api/algorithms/closest-pair',
    { method: 'POST', body: input },
  )
}

export function evaluateAco(input: {
  scenarioId: string
  overrides?: AlgorithmOverrides
}): Promise<EvaluationResponse<AcoEvaluationResult>> {
  return apiRequest<EvaluationResponse<AcoEvaluationResult>>('/api/algorithms/aco', {
    method: 'POST',
    body: input,
  })
}

/* Scenario simulator ------------------------------------------------------- */

export function cloneScenario(
  scenarioId: string,
  body: { name?: string; description?: string | null } = {},
): Promise<CloneScenarioResponse> {
  return apiRequest<CloneScenarioResponse>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/clone`,
    { method: 'POST', body },
  )
}

export function updateScenarioRoad(
  scenarioId: string,
  roadId: string,
  isAvailable: boolean,
): Promise<RoadMutationResponse> {
  return apiRequest<RoadMutationResponse>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/roads/${encodeURIComponent(roadId)}`,
    { method: 'PATCH', body: { isAvailable } },
  )
}

export function updateScenarioVehicle(
  scenarioId: string,
  vehicleId: string,
  patch: { isAvailable?: boolean; capacityUnits?: number; allowLargeStateSpace?: boolean },
): Promise<VehicleMutationResponse> {
  return apiRequest<VehicleMutationResponse>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/vehicles/${encodeURIComponent(vehicleId)}`,
    { method: 'PATCH', body: patch },
  )
}

export function updateScenarioDonation(
  scenarioId: string,
  donationId: string,
  patch: { weightUnits?: number; valueScore?: number; status?: DonationRecord['status'] },
): Promise<DonationMutationResponse> {
  return apiRequest<DonationMutationResponse>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/donations/${encodeURIComponent(donationId)}`,
    { method: 'PATCH', body: patch },
  )
}

export function updateScenarioRecipient(
  scenarioId: string,
  recipientId: string,
  patch: { demandUnits?: number; priorityScore?: number; isAvailable?: boolean },
): Promise<RecipientMutationResponse> {
  return apiRequest<RecipientMutationResponse>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/recipients/${encodeURIComponent(recipientId)}`,
    { method: 'PATCH', body: patch },
  )
}

export function reduceScenarioSupply(
  scenarioId: string,
  percent: number,
): Promise<SupplyReduceResponse> {
  return apiRequest<SupplyReduceResponse>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/supply/reduce`,
    { method: 'POST', body: { percent } },
  )
}

export function createSensitivityVariant(
  scenarioId: string,
  removeTopUrgencyCount: number,
): Promise<SensitivityResponse> {
  return apiRequest<SensitivityResponse>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/sensitivity`,
    { method: 'POST', body: { removeTopUrgencyCount } },
  )
}

export function getScenarioChanges(
  scenarioId: string,
  limit = 50,
): Promise<ScenarioChangesResponse> {
  return apiRequest<ScenarioChangesResponse>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/changes?limit=${limit}`,
  )
}

export function compareScenarioRuns(
  scenarioId: string,
  baseRunId: string,
  variantRunId: string,
): Promise<ComparisonResponse> {
  const query = new URLSearchParams({ baseRunId, variantRunId })
  return apiRequest<ComparisonResponse>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/compare?${query.toString()}`,
  )
}

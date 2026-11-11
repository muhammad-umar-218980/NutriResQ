/** Typed calls for the optimization domain endpoints (admin workspace). */

import { apiRequest } from './api'
import type {
  AcoEvaluationResult,
  AstarEvaluation,
  ClosestPairEvaluationResult,
  EvaluationResponse,
  KnapsackEvaluationResult,
  RunResponse,
  RunsResponse,
  ScenariosResponse,
  SnapshotResponse,
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

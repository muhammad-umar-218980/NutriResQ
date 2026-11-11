import type { PoolClient } from 'pg';
import { query } from '../db/pool';
import type {
  AlgorithmConfig,
  BenchmarkRecord,
  Metrics,
  OptimizationResult,
  RunDetail,
  RunStatus,
  RunSummary,
  Warning,
} from '../types/domain';

interface RunRow {
  id: string;
  scenario_id: string;
  scenario_name: string | null;
  parent_run_id: string | null;
  run_by: string | null;
  status: RunStatus;
  algorithm_config: AlgorithmConfig;
  input_snapshot: Record<string, unknown>;
  metrics: Metrics | Record<string, unknown>;
  warnings: Warning[];
  result_json: OptimizationResult | null;
  error_code: string | null;
  error_message: string | null;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
}

interface BenchmarkRow {
  id: string;
  algorithm_name: string;
  baseline_name: string | null;
  configuration: Record<string, unknown>;
  result_summary: Record<string, unknown>;
  runtime_ms: number;
  trial_number: number;
  created_at: Date;
}

export interface ScenarioRunList {
  runs: RunSummary[];
  total: number;
  page: number;
  pageSize: number;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toRunSummary(row: RunRow): RunSummary {
  const result = row.result_json;
  const running = row.status === 'running';

  return {
    id: row.id,
    scenarioId: row.scenario_id,
    scenarioName: row.scenario_name,
    parentRunId: row.parent_run_id,
    runBy: row.run_by,
    status: row.status,
    algorithmConfig: row.algorithm_config,
    metrics: running ? null : (row.metrics as Metrics),
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    inputCounts: result?.inputCounts ?? null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    startedAt: toIso(row.started_at),
    completedAt: row.completed_at ? toIso(row.completed_at) : null,
    createdAt: toIso(row.created_at),
  };
}

function toBenchmark(row: BenchmarkRow): BenchmarkRecord {
  return {
    algorithmName: row.algorithm_name,
    baselineName: row.baseline_name,
    configuration: row.configuration,
    resultSummary: row.result_summary,
    runtimeMs: row.runtime_ms,
    trialNumber: row.trial_number,
  };
}

export async function insertRunningRun(input: {
  scenarioId: string;
  runBy: string | null;
  algorithmConfig: AlgorithmConfig;
  inputSnapshot: unknown;
  startedAt: string;
}): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO optimization_runs
       (scenario_id, run_by, status, algorithm_config, input_snapshot, started_at)
     VALUES ($1, $2, 'running', $3::jsonb, $4::jsonb, $5)
     RETURNING id`,
    [
      input.scenarioId,
      input.runBy,
      JSON.stringify(input.algorithmConfig),
      JSON.stringify(input.inputSnapshot),
      input.startedAt,
    ],
  );
  return result.rows[0].id;
}

export async function finalizeRun(
  client: PoolClient,
  input: {
    runId: string;
    status: RunStatus;
    metrics: Metrics | null;
    warnings: Warning[];
    result: OptimizationResult | null;
    errorCode: string | null;
    errorMessage: string | null;
    completedAt: string;
  },
): Promise<void> {
  await client.query(
    `UPDATE optimization_runs
        SET status = $2,
            metrics = $3::jsonb,
            warnings = $4::jsonb,
            result_json = $5::jsonb,
            error_code = $6,
            error_message = $7,
            completed_at = $8
      WHERE id = $1`,
    [
      input.runId,
      input.status,
      JSON.stringify(input.metrics ?? {}),
      JSON.stringify(input.warnings),
      input.result ? JSON.stringify(input.result) : null,
      input.errorCode,
      input.errorMessage,
      input.completedAt,
    ],
  );
}

export interface PersistLabels {
  vehicleName: (vehicleId: string) => string;
  donationName: (donationId: string) => string;
  locationName: (locationId: string) => string;
  donationInfo: (donationId: string) => {
    weightUnits: number;
    objectiveValue: number;
  } | null;
}

export async function persistRunDetails(
  client: PoolClient,
  input: {
    runId: string;
    result: OptimizationResult;
    labels: PersistLabels;
  },
): Promise<void> {
  const { runId, result, labels } = input;

  for (const allocation of result.allocations) {
    for (const donationId of allocation.donationIds) {
      const info = labels.donationInfo(donationId);
      if (!info) continue;

      await client.query(
        `INSERT INTO vehicle_allocations
           (run_id, vehicle_id, donation_id, vehicle_label, donation_label,
            assigned_weight_units, value_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (run_id, donation_id) DO NOTHING`,
        [
          runId,
          allocation.vehicleId,
          donationId,
          labels.vehicleName(allocation.vehicleId),
          labels.donationName(donationId),
          info.weightUnits,
          info.objectiveValue,
        ],
      );
    }
  }

  for (const route of result.routes) {
    const routeInsert = await client.query<{ id: string }>(
      `INSERT INTO routes
         (run_id, vehicle_id, vehicle_label, status, total_cost, cost_unit,
          algorithm_name, algorithm_config, infeasible_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       RETURNING id`,
      [
        runId,
        route.vehicleId,
        labels.vehicleName(route.vehicleId),
        route.status,
        route.totalCost,
        route.costUnit,
        route.algorithmName,
        JSON.stringify(route.algorithmConfig),
        route.infeasibleReason ?? null,
      ],
    );
    const routeId = routeInsert.rows[0].id;

    for (const stop of route.stops) {
      await client.query(
        `INSERT INTO route_stops
           (route_id, sequence_number, location_id, location_label, stop_type,
            related_donation_id, related_recipient_id, leg_cost_from_previous, leg_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
        [
          routeId,
          stop.sequenceNumber,
          stop.locationId,
          labels.locationName(stop.locationId),
          stop.stopType,
          stop.relatedDonationId,
          stop.relatedRecipientId,
          stop.legCostFromPrevious,
          JSON.stringify(stop.legPath),
        ],
      );
    }
  }
}

export async function insertBenchmarks(
  client: PoolClient,
  input: {
    runId: string;
    scenarioId: string;
    inputFingerprint: string;
    benchmarks: BenchmarkRecord[];
  },
): Promise<void> {
  for (const benchmark of input.benchmarks) {
    await client.query(
      `INSERT INTO algorithm_benchmarks
         (run_id, scenario_id, algorithm_name, baseline_name, input_fingerprint,
          configuration, result_summary, runtime_ms, memory_bytes, trial_number)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, NULL, $9)`,
      [
        input.runId,
        input.scenarioId,
        benchmark.algorithmName,
        benchmark.baselineName,
        input.inputFingerprint,
        JSON.stringify(benchmark.configuration),
        JSON.stringify(benchmark.resultSummary),
        benchmark.runtimeMs,
        benchmark.trialNumber,
      ],
    );
  }
}

export async function findRunById(id: string): Promise<RunDetail | null> {
  const result = await query<RunRow>(
    `SELECT r.*, s.name AS scenario_name
       FROM optimization_runs r
       JOIN scenarios s ON s.id = r.scenario_id
      WHERE r.id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;

  const benchmarkResult = await query<BenchmarkRow>(
    `SELECT * FROM algorithm_benchmarks WHERE run_id = $1 ORDER BY created_at ASC, id ASC`,
    [id],
  );

  return {
    ...toRunSummary(row),
    result: row.result_json,
    benchmarks: benchmarkResult.rows.map(toBenchmark),
  };
}

export async function listRunsForScenario(
  scenarioId: string,
  page: number,
  pageSize: number,
): Promise<ScenarioRunList> {
  const offset = (page - 1) * pageSize;

  const countResult = await query<{ total: string }>(
    'SELECT count(*)::text AS total FROM optimization_runs WHERE scenario_id = $1',
    [scenarioId],
  );

  const result = await query<RunRow>(
    `SELECT r.*, s.name AS scenario_name
       FROM optimization_runs r
       JOIN scenarios s ON s.id = r.scenario_id
      WHERE r.scenario_id = $1
      ORDER BY r.created_at DESC, r.id ASC
      LIMIT $2 OFFSET $3`,
    [scenarioId, pageSize, offset],
  );

  return {
    runs: result.rows.map(toRunSummary),
    total: Number(countResult.rows[0]?.total ?? 0),
    page,
    pageSize,
  };
}

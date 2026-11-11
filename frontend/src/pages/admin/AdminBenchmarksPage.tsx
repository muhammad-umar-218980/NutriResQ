import { useState } from 'react'
import BenchmarkTable from '../../components/app/BenchmarkTable'
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
} from '../../components/app/ui'
import { useApi } from '../../hooks/useApi'
import { formatDateTime } from '../../lib/format'
import type {
  RunDetail,
  RunResponse,
  RunsResponse,
  ScenariosResponse,
} from '../../types/domain'
import './AdminWorkspace.css'

function formatInt(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/**
 * Benchmark history for a stored run. Measurements are read from result_json /
 * algorithm_benchmarks exactly as recorded — nothing is recomputed here.
 */
export default function AdminBenchmarksPage() {
  const scenarios = useApi<ScenariosResponse>('/api/scenarios')
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const scenarioId = selectedScenarioId ?? scenarios.data?.scenarios[0]?.id ?? null

  const runs = useApi<RunsResponse>(
    scenarioId
      ? `/api/scenarios/${encodeURIComponent(scenarioId)}/runs?page=1&pageSize=20`
      : null,
  )

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const runId = selectedRunId ?? runs.data?.runs[0]?.id ?? null
  const run = useApi<RunResponse>(runId ? `/api/runs/${encodeURIComponent(runId)}` : null)

  const scenario = scenarios.data?.scenarios.find((entry) => entry.id === scenarioId) ?? null
  const runCount = runs.data?.total ?? 0

  function changeScenario(nextId: string) {
    setSelectedScenarioId(nextId)
    setSelectedRunId(null)
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin workspace"
        title="Benchmarks"
        description="Same-input measurements recorded with each optimization run. Runtime is reported as measured; it is never treated as evidence of better quality."
      />

      {scenarios.error ? (
        <Card>
          <ErrorState message={scenarios.error} onRetry={scenarios.reload} />
        </Card>
      ) : scenarios.loading && !scenarios.data ? (
        <Card>
          <LoadingRows label="Loading scenarios…" />
        </Card>
      ) : !scenario ? (
        <Card>
          <EmptyState
            title="No scenario is stored"
            body="Seed the database and run an optimization before comparing benchmarks."
          />
        </Card>
      ) : (
        <>
          <Card
            title={scenario.name}
            description={`${formatInt(scenario.counts.locations)} locations · ${formatInt(
              scenario.counts.roads,
            )} roads · ${formatInt(scenario.counts.donations)} donations · ${formatInt(
              scenario.counts.vehicles,
            )} vehicles`}
            actions={
              <div className="opt-field opt-field--inline">
                <label htmlFor="bench-scenario">Scenario</label>
                <select
                  id="bench-scenario"
                  value={scenario.id}
                  onChange={(event) => changeScenario(event.target.value)}
                  disabled={(scenarios.data?.scenarios.length ?? 0) < 2}
                >
                  {(scenarios.data?.scenarios ?? []).map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </div>
            }
          >
            <div className="opt-field opt-field--inline">
              <label htmlFor="bench-run">Stored run</label>
              <select
                id="bench-run"
                value={runId ?? ''}
                onChange={(event) => setSelectedRunId(event.target.value)}
                disabled={runCount < 2}
              >
                {(runs.data?.runs ?? []).map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {formatDateTime(entry.startedAt)} · {entry.status} · {entry.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <span className="metric-note">
                {runs.loading && !runs.data
                  ? 'Loading stored runs…'
                  : runCount === 0
                    ? 'No runs recorded yet.'
                    : `${formatInt(runCount)} run${runCount === 1 ? '' : 's'} stored for this scenario.`}
              </span>
            </div>
          </Card>

          {runs.error ? (
            <Card>
              <ErrorState message={runs.error} onRetry={runs.reload} />
            </Card>
          ) : runs.loading && !runs.data ? (
            <Card>
              <LoadingRows label="Loading run history…" />
            </Card>
          ) : runCount === 0 ? (
            <Card>
              <EmptyState
                title="No benchmarks yet"
                body="Open the algorithm workspace and run the optimizer to record A*, DP, closest-pair and ACO measurements."
              />
            </Card>
          ) : run.error ? (
            <Card>
              <ErrorState message={run.error} onRetry={run.reload} />
            </Card>
          ) : run.loading && !run.data ? (
            <Card>
              <LoadingRows label="Loading stored benchmarks…" />
            </Card>
          ) : run.data ? (
            <RunBenchmarks run={run.data.run} />
          ) : null}

          <Card title="How to read these numbers">
            <ul className="benchmark-notes">
              <li>
                <strong>A* vs Dijkstra</strong> — both search the same road graph with closed roads
                excluded. Node-expansion counts and runtimes are measured per request; Dijkstra is
                the zero-heuristic baseline, not a different cost model.
              </li>
              <li>
                <strong>Multiple-knapsack DP vs greedy</strong> — the DP enumerates the joint
                capacity vector, so its allocated objective value is exact for the given inputs and
                state limit. The greedy value-density result is a labelled baseline and may be
                lower.
              </li>
              <li>
                <strong>Divide-and-conquer closest pair vs brute force</strong> — both use
                straight-line Euclidean distance between projected location coordinates. This is
                not road distance, and equal distances only mean the two implementations agree.
              </li>
              <li>
                <strong>ACO vs nearest neighbour</strong> — ACO is a seeded heuristic. A lower cost
                than the baseline is an observation for that seed and trial count, not a
                guarantee of optimality.
              </li>
            </ul>
          </Card>
        </>
      )}
    </>
  )
}

function RunBenchmarks({ run }: { run: RunDetail }) {
  const metrics = run.metrics
  const result = run.result

  return (
    <>
      <Card
        title={`Run ${run.id.slice(0, 8)}`}
        description={`Started ${formatDateTime(run.startedAt)}${
          run.completedAt ? ` · completed ${formatDateTime(run.completedAt)}` : ''
        }. Status: ${run.status}.`}
      >
        <div className="run-meta">
          <span>
            Allocated weight:{' '}
            <strong>{metrics ? `${formatInt(metrics.allocatedPackageWeightUnits)} kg` : '—'}</strong>
          </span>
          <span>
            Objective value:{' '}
            <strong>{metrics ? formatInt(metrics.allocatedPackageValue) : '—'}</strong>
          </span>
          <span>
            Road cost:{' '}
            <strong>
              {metrics
                ? `${formatNumber(metrics.totalRoadCost, 2)} ${metrics.totalRoadCostUnit}`
                : '—'}
            </strong>
          </span>
          <span>
            Server runtime:{' '}
            <strong>{metrics ? `${formatNumber(metrics.runtimeMs, 1)} ms` : '—'}</strong>
          </span>
          {result ? (
            <span>
              ACO seed: <strong>{result.algorithmConfig.aco.seed}</strong>
            </span>
          ) : null}
        </div>

        {run.errorMessage ? (
          <p className="notice notice--error" role="alert">
            {run.errorMessage}
          </p>
        ) : null}
      </Card>

      <Card
        title="Recorded measurements"
        description="Each benchmark stores its configuration, result summary and measured runtime at run time."
      >
        <BenchmarkTable benchmarks={run.benchmarks} />
      </Card>
    </>
  )
}

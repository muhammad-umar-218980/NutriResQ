import { useState } from 'react'
import type { FormEvent } from 'react'
import BenchmarkTable from '../../components/app/BenchmarkTable'
import RouteSchematic from '../../components/app/RouteSchematic'
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  StatCard,
} from '../../components/app/ui'
import { useApi } from '../../hooks/useApi'
import { getRun, startOptimization } from '../../lib/domain-api'
import { formatDateTime } from '../../lib/format'
import type {
  OptimizationResult,
  RunDetail,
  RunStatus,
  RunSummary,
  ScenarioSnapshot,
  ScenarioSummary,
  ScenariosResponse,
  SnapshotResponse,
} from '../../types/domain'
import './AdminWorkspace.css'

interface RunForm {
  heuristic: 'projected-distance' | 'zero'
  maxStates: string
  seed: string
  numTrials: string
  numAnts: string
}

const DEFAULT_FORM: RunForm = {
  heuristic: 'projected-distance',
  maxStates: '250000',
  seed: '42',
  numTrials: '20',
  numAnts: '0',
}

function formatInt(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function statusClass(status: string): string {
  switch (status) {
    case 'succeeded':
    case 'complete':
    case 'active':
      return 'pill pill--active'
    case 'partial':
    case 'running':
      return 'pill pill--warning'
    case 'failed':
    case 'infeasible':
      return 'pill pill--suspended'
    default:
      return 'pill pill--neutral'
  }
}

function RunStatusPill({ status }: { status: RunStatus | OptimizationResult['status'] }) {
  return <span className={statusClass(status)}>{status}</span>
}

export default function AdminWorkspacePage() {
  const scenarios = useApi<ScenariosResponse>('/api/scenarios')
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const scenarioId = selectedScenarioId ?? scenarios.data?.scenarios[0]?.id ?? null

  const snapshot = useApi<SnapshotResponse>(
    scenarioId ? `/api/scenarios/${encodeURIComponent(scenarioId)}/snapshot` : null,
  )
  const runs = useApi<{ success: boolean; runs: RunSummary[]; total: number }>(
    scenarioId ? getScenarioRunsPath(scenarioId) : null,
  )

  const [form, setForm] = useState<RunForm>(DEFAULT_FORM)
  const [run, setRun] = useState<RunDetail | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [openingRunId, setOpeningRunId] = useState<string | null>(null)

  const scenario =
    scenarios.data?.scenarios.find((entry) => entry.id === scenarioId) ?? null

  function handleScenarioChange(nextId: string) {
    setSelectedScenarioId(nextId)
    setRun(null)
    setRunError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!scenarioId) return

    setBusy(true)
    setRunError(null)

    try {
      const response = await startOptimization(scenarioId, {
        astarHeuristic: form.heuristic,
        knapsack: { maxStates: Number(form.maxStates) },
        aco: {
          seed: Number(form.seed),
          numTrials: Number(form.numTrials),
          numAnts: Number(form.numAnts),
        },
      })
      setRun(response.run)
      runs.reload()
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'The optimization run failed.')
    } finally {
      setBusy(false)
    }
  }

  async function openPreviousRun(runId: string) {
    setOpeningRunId(runId)
    setRunError(null)
    try {
      const response = await getRun(runId)
      setRun(response.run)
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'That run could not be opened.')
    } finally {
      setOpeningRunId(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin workspace"
        title="Algorithm workspace"
        description="Run the exact A*, multiple-knapsack DP, divide-and-conquer closest pair and ACO pipeline against a stored scenario. Every metric, route and benchmark below comes from the API result."
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
            body="Seed the database before running the optimizer."
          />
        </Card>
      ) : (
        <>
          <ScenarioCard
            scenario={scenario}
            scenarios={scenarios.data?.scenarios ?? []}
            onScenarioChange={handleScenarioChange}
          />

          <Card
            title="Run configuration"
            description="Parameters are recorded with the run. Seed -1 draws a fresh seed; every other number keeps the run reproducible."
          >
            <form className="opt-form" onSubmit={(event) => void handleSubmit(event)}>
              <div className="opt-form__grid">
                <div className="opt-field">
                  <label htmlFor="opt-heuristic">A* heuristic</label>
                  <select
                    id="opt-heuristic"
                    value={form.heuristic}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        heuristic: event.target.value as RunForm['heuristic'],
                      }))
                    }
                  >
                    <option value="projected-distance">Projected straight-line (admissible)</option>
                    <option value="zero">Zero (always admissible)</option>
                  </select>
                  <p className="opt-field__hint">
                    A* still searches the stored road graph; the heuristic only guides expansion.
                  </p>
                </div>

                <div className="opt-field">
                  <label htmlFor="opt-max-states">Knapsack state limit</label>
                  <input
                    id="opt-max-states"
                    type="number"
                    min={1}
                    max={5000000}
                    value={form.maxStates}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, maxStates: event.target.value }))
                    }
                  />
                  <p className="opt-field__hint">
                    Exact DP stops with a clear error instead of approximating when the capacity
                    vector space is larger than this.
                  </p>
                </div>

                <div className="opt-field">
                  <label htmlFor="opt-seed">ACO seed</label>
                  <input
                    id="opt-seed"
                    type="number"
                    min={-1}
                    max={2147483646}
                    value={form.seed}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, seed: event.target.value }))
                    }
                  />
                </div>

                <div className="opt-field">
                  <label htmlFor="opt-trials">ACO trials</label>
                  <input
                    id="opt-trials"
                    type="number"
                    min={1}
                    max={10000}
                    value={form.numTrials}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, numTrials: event.target.value }))
                    }
                  />
                </div>

                <div className="opt-field">
                  <label htmlFor="opt-ants">Ants per trial</label>
                  <input
                    id="opt-ants"
                    type="number"
                    min={0}
                    max={1000}
                    value={form.numAnts}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, numAnts: event.target.value }))
                    }
                  />
                  <p className="opt-field__hint">0 = auto (√jobs, at least 1).</p>
                </div>
              </div>

              <div className="opt-form__actions">
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? 'Running optimization…' : 'Run optimization'}
                </button>
                <p className="opt-field__hint">
                  ACO is a heuristic. The run records its measured result; no optimality is claimed.
                </p>
              </div>
            </form>

            {runError ? (
              <p className="notice notice--error" role="alert">
                {runError}
              </p>
            ) : null}
          </Card>

          {run ? (
            <RunResultView run={run} snapshot={snapshot.data?.snapshot ?? null} />
          ) : snapshot.loading && !snapshot.data ? (
            <Card>
              <LoadingRows label="Loading scenario snapshot…" />
            </Card>
          ) : (
            <Card>
              <EmptyState
                title="No run selected"
                body="Run the optimizer above, or open a previous run. Results include allocations, A* route legs, unreachable pairs, the closest pair and algorithm benchmarks."
              />
            </Card>
          )}

          <Card
            title="Previous runs"
            description="Stored results are returned from result_json; opening a run never recomputes it with newer code."
          >
            {runs.error ? (
              <ErrorState message={runs.error} onRetry={runs.reload} />
            ) : runs.loading && !runs.data ? (
              <LoadingRows label="Loading run history…" />
            ) : runs.data && runs.data.runs.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <caption>Runs recorded for this scenario</caption>
                  <thead>
                    <tr>
                      <th scope="col">Started</th>
                      <th scope="col">Status</th>
                      <th scope="col">Allocated weight</th>
                      <th scope="col">Road cost</th>
                      <th scope="col">Runtime</th>
                      <th scope="col" className="data-table__actions">
                        <span className="visually-hidden">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.data.runs.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <span className="data-table__name">{formatDateTime(entry.startedAt)}</span>
                          <span className="data-table__sub">{entry.id}</span>
                        </td>
                        <td>
                          <RunStatusPill status={entry.status} />
                        </td>
                        <td>
                          {entry.metrics
                            ? `${formatInt(entry.metrics.allocatedPackageWeightUnits)} kg`
                            : '—'}
                        </td>
                        <td>
                          {entry.metrics
                            ? `${formatNumber(entry.metrics.totalRoadCost, 2)} ${
                                entry.metrics.totalRoadCostUnit
                              }`
                            : '—'}
                        </td>
                        <td>{entry.metrics ? `${formatNumber(entry.metrics.runtimeMs, 1)} ms` : '—'}</td>
                        <td className="data-table__actions">
                          <button
                            type="button"
                            className="btn-secondary btn-secondary--small"
                            onClick={() => void openPreviousRun(entry.id)}
                            disabled={openingRunId !== null}
                          >
                            {openingRunId === entry.id ? 'Opening…' : 'Open'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="metric-note">No runs have been recorded yet.</p>
            )}
          </Card>
        </>
      )}
    </>
  )
}

function getScenarioRunsPath(scenarioId: string): string {
  return `/api/scenarios/${encodeURIComponent(scenarioId)}/runs?pageSize=8`
}

function ScenarioCard({
  scenario,
  scenarios,
  onScenarioChange,
}: {
  scenario: ScenarioSummary
  scenarios: ScenarioSummary[]
  onScenarioChange: (id: string) => void
}) {
  return (
    <Card
      title={scenario.name}
      description={scenario.description ?? undefined}
      actions={
        scenarios.length > 1 ? (
          <div className="opt-field opt-field--inline">
            <label htmlFor="opt-scenario">Scenario</label>
            <select
              id="opt-scenario"
              value={scenario.id}
              onChange={(event) => onScenarioChange(event.target.value)}
            >
              {scenarios.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>
        ) : undefined
      }
    >
      <div className="scenario-facts">
        <span>
          <strong>{scenario.counts.locations}</strong> locations
        </span>
        <span>
          <strong>{scenario.counts.roads}</strong> roads
        </span>
        <span>
          <strong>{scenario.counts.donations}</strong> donations
        </span>
        <span>
          <strong>{scenario.counts.vehicles}</strong> vehicles
        </span>
        <span>
          <strong>{scenario.counts.runs}</strong> stored runs
        </span>
        <span className={statusClass(scenario.status)}>{scenario.status}</span>
      </div>
    </Card>
  )
}

function RunResultView({ run, snapshot }: { run: RunDetail; snapshot: ScenarioSnapshot | null }) {
  const result = run.result
  if (!result) {
    return (
      <Card title="Run result">
        <p className="notice notice--error" role="alert">
          {run.errorMessage ?? 'This run does not contain a stored result.'}
        </p>
      </Card>
    )
  }

  const locationName = new Map((snapshot?.locations ?? []).map((entry) => [entry.id, entry.name]))
  const donationName = new Map(
    (snapshot?.donations ?? []).map((entry) => [entry.id, entry.packageName]),
  )
  const vehicleName = new Map((snapshot?.vehicles ?? []).map((entry) => [entry.id, entry.name]))
  const metrics = result.metrics

  return (
    <>
      <Card
        title={`Run ${run.id.slice(0, 8)}`}
        description={`Scenario: ${run.scenarioName ?? run.scenarioId}. Started ${formatDateTime(
          run.startedAt,
        )}${run.completedAt ? ` · completed ${formatDateTime(run.completedAt)}` : ''}.`}
        actions={<RunStatusPill status={run.status} />}
      >
        <div className="run-meta">
          <span>
            A* heuristic: <strong>{result.algorithmConfig.astarHeuristic}</strong>
          </span>
          <span>
            Knapsack max states: <strong>{formatInt(result.algorithmConfig.knapsack.maxStates)}</strong>
          </span>
          <span>
            ACO seed: <strong>{result.algorithmConfig.aco.seed}</strong>
          </span>
          <span>
            ACO trials: <strong>{result.algorithmConfig.aco.numTrials}</strong>
          </span>
          <span>
            ACO ants: <strong>{result.algorithmConfig.aco.numAnts === 0 ? 'auto' : result.algorithmConfig.aco.numAnts}</strong>
          </span>
          <span>
            Algorithm version: <strong>{result.algorithmConfig.algorithmVersion}</strong>
          </span>
        </div>

        {result.errors.length > 0 ? (
          <div className="notice notice--error" role="alert">
            <strong>The run reported errors.</strong>
            <ul>
              {result.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {result.warnings.length > 0 ? (
          <div className="notice notice--warning">
            <strong>Warnings reported by the pipeline</strong>
            <ul>
              {result.warnings.map((warning) => (
                <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <div className="stat-grid">
        <StatCard
          label="Allocated objective value"
          value={formatInt(metrics.allocatedPackageValue)}
          hint="value_score × recipient priority (priority 1 when none)"
        />
        <StatCard
          label="Allocated weight"
          value={`${formatInt(metrics.allocatedPackageWeightUnits)} kg`}
          hint={`${formatInt(result.inputCounts.eligibleDonations)} donations passed the eligibility rules`}
        />
        <StatCard
          label="Capacity utilisation"
          value={`${formatNumber(metrics.vehicleCapacityUtilization, 2)}%`}
          hint={`${formatInt(result.inputCounts.availableVehicles)} of ${formatInt(
            result.inputCounts.vehicles,
          )} vehicles usable`}
        />
        <StatCard
          label="Measured road cost"
          value={`${formatNumber(metrics.totalRoadCost, 2)} ${metrics.totalRoadCostUnit}`}
          hint="Sum of A* leg costs for stored routes"
        />
        <StatCard
          label="Routes"
          value={metrics.routeCount}
          hint={`${metrics.partialRouteCount} partial`}
        />
        <StatCard
          label="Unreachable pairs"
          value={metrics.unreachablePairCount}
          hint={`${formatInt(metrics.reachablePairCount)} of ${formatInt(
            metrics.reachablePairCount + metrics.unreachablePairCount,
          )} checked pairs reachable`}
        />
        <StatCard
          label="Unallocated packages"
          value={metrics.unallocatedPackageCount}
          hint="Expired, ineligible, oversized or capacity-limited"
        />
        <StatCard
          label="Server runtime"
          value={`${formatNumber(metrics.runtimeMs, 1)} ms`}
          hint="Measured by the optimization service"
        />
      </div>

      <Card
        title="Vehicle allocations"
        description="Exact multiple-knapsack DP. Each package belongs to at most one vehicle and capacity is never exceeded."
      >
        <div className="table-wrap">
          <table className="data-table">
            <caption>Allocated packages per vehicle</caption>
            <thead>
              <tr>
                <th scope="col">Vehicle</th>
                <th scope="col">Packages</th>
                <th scope="col">Weight / capacity</th>
                <th scope="col">Utilisation</th>
                <th scope="col">Objective value</th>
              </tr>
            </thead>
            <tbody>
              {result.allocations.map((allocation) => (
                <tr key={allocation.vehicleId}>
                  <th scope="row">{vehicleName.get(allocation.vehicleId) ?? allocation.vehicleId}</th>
                  <td>
                    {allocation.donationIds.length === 0 ? (
                      <span className="data-table__sub">No packages</span>
                    ) : (
                      <ul className="inline-list">
                        {allocation.donationIds.map((donationId) => (
                          <li key={donationId}>
                            {donationName.get(donationId) ?? donationId}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>
                    {formatInt(allocation.totalWeightUnits)} / {formatInt(allocation.capacityUnits)} kg
                  </td>
                  <td>{formatNumber(allocation.utilization, 1)}%</td>
                  <td>{formatInt(allocation.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {snapshot ? (
        <Card
          title="Route schematic"
          description="Stored locations and computed legs. The map is schematic; route costs come from A* on the road graph, not from these straight lines."
        >
          <RouteSchematic snapshot={snapshot} routes={result.routes} />
        </Card>
      ) : null}

      <Card
        title="Routes and ordered stops"
        description="Stops are derived only from allocated packages. ACO ordered the pickup/delivery jobs using A* road costs; this is a heuristic result."
      >
        <div className="route-list">
          {result.routes.map((route) => {
            const required = route.status !== 'not_required'
            return (
              <article className="route-card" key={route.vehicleId}>
                <header className="route-card__head">
                  <div>
                    <h3>{vehicleName.get(route.vehicleId) ?? route.vehicleId}</h3>
                    <p className="route-card__meta">
                      {route.algorithmName === 'none'
                        ? 'No route required'
                        : `${route.algorithmName} · ${formatNumber(route.totalCost, 2)} ${
                            route.costUnit
                          }`}
                    </p>
                  </div>
                  <span className={statusClass(route.status)}>{route.status}</span>
                </header>

                {route.infeasibleReason ? (
                  <p className="notice notice--warning">{route.infeasibleReason}</p>
                ) : null}

                {required && route.stops.length > 0 ? (
                  <ol className="route-stops">
                    {route.stops.map((stop) => (
                      <li key={`${route.vehicleId}-${stop.sequenceNumber}`}>
                        <span className={`stop-type stop-type--${stop.stopType}`}>{stop.stopType}</span>
                        <span className="route-stops__place">
                          {locationName.get(stop.locationId) ?? stop.locationId}
                        </span>
                        {stop.relatedDonationId ? (
                          <span className="route-stops__load">
                            {donationName.get(stop.relatedDonationId) ?? stop.relatedDonationId}
                          </span>
                        ) : null}
                        <span className="route-stops__leg">
                          {stop.legCostFromPrevious === null
                            ? 'start'
                            : `+${formatNumber(stop.legCostFromPrevious, 2)} ${route.costUnit}`}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="metric-note">No assigned packages for this vehicle.</p>
                )}
              </article>
            )
          })}
        </div>
      </Card>

      <Card
        title="Unallocated packages"
        description="Nothing is silently dropped: every excluded package is listed with its reason."
      >
        {result.unallocated.length === 0 ? (
          <p className="metric-note">Every eligible package was allocated.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption>Packages not assigned to a vehicle</caption>
              <thead>
                <tr>
                  <th scope="col">Package</th>
                  <th scope="col">Weight</th>
                  <th scope="col">Value score</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {result.unallocated.map((entry) => (
                  <tr key={entry.donationId}>
                    <th scope="row">{entry.packageName}</th>
                    <td>{formatInt(entry.weightUnits)} kg</td>
                    <td>{entry.valueScore}</td>
                    <td>
                      <span className={statusClass(entry.reason === 'insufficient_capacity' ? 'partial' : 'failed')}>
                        {entry.reason}
                      </span>
                    </td>
                    <td>{entry.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Network connectivity"
        description="A* is run for ordered scenario location pairs. Unreachable pairs are reported, never treated as an ordinary cost."
      >
        {result.unreachable.length === 0 ? (
          <p className="metric-note">Every checked ordered pair is reachable.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption>Unreachable ordered location pairs</caption>
              <thead>
                <tr>
                  <th scope="col">From</th>
                  <th scope="col">To</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {result.unreachable.map((pair) => (
                  <tr key={`${pair.fromLocationId}-${pair.toLocationId}`}>
                    <th scope="row">{pair.fromName}</th>
                    <td>{pair.toName}</td>
                    <td>{pair.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Closest pair"
        description="Divide-and-conquer closest pair over stored locations."
      >
        {result.closestPair ? (
          <div className="closest-pair">
            <p className="closest-pair__value">
              {result.closestPair.distanceMeters === null
                ? 'Unavailable'
                : `${formatNumber(result.closestPair.distanceMeters, 1)} m`}
            </p>
            <p>
              {result.closestPair.p1?.name ?? '—'} ↔ {result.closestPair.p2?.name ?? '—'}
            </p>
            <p className="metric-note">{result.closestPair.note}</p>
            <p className="metric-note">
              Coordinate system: {result.closestPair.coordinateSystem} · Units:{' '}
              {result.closestPair.units}. This is straight-line projected distance, not road
              distance.
            </p>
          </div>
        ) : (
          <p className="metric-note">No closest pair was computed for this run.</p>
        )}
      </Card>

      <Card
        title="Benchmarks"
        description="Same-input comparisons. Runtime is reported; it is never treated as proof of better quality."
      >
        <BenchmarkTable benchmarks={run.benchmarks} />
      </Card>
    </>
  )
}

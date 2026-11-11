import { useState } from 'react'
import type { FormEvent } from 'react'
import BenchmarkTable from '../../components/app/BenchmarkTable'
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
} from '../../components/app/ui'
import { useApi } from '../../hooks/useApi'
import {
  evaluateAco,
  evaluateAstar,
  evaluateClosestPair,
  evaluateKnapsack,
} from '../../lib/domain-api'
import type {
  AcoEvaluationResult,
  AlgorithmEvaluation,
  AstarEvaluation,
  ClosestPairEvaluationResult,
  KnapsackEvaluationResult,
  ScenariosResponse,
  SnapshotResponse,
} from '../../types/domain'
import './AdminWorkspace.css'

type TabId = 'astar' | 'knapsack' | 'closest-pair' | 'aco'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'astar', label: 'A* search' },
  { id: 'knapsack', label: 'Multiple-knapsack DP' },
  { id: 'closest-pair', label: 'Closest pair' },
  { id: 'aco', label: 'ACO routing' },
]

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function formatInt(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

function statusClass(status: string): string {
  switch (status) {
    case 'succeeded':
    case 'complete':
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The algorithm evaluation failed.'
}

function EvaluationNotices({
  evaluation,
}: {
  evaluation: AlgorithmEvaluation<unknown> | null
}) {
  if (!evaluation) return null
  return (
    <>
      <p className="metric-note">{evaluation.note}</p>
      {evaluation.errors.length > 0 ? (
        <div className="notice notice--error" role="alert">
          <strong>Errors</strong>
          <ul>
            {evaluation.errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {evaluation.warnings.length > 0 ? (
        <div className="notice notice--warning">
          <strong>Warnings</strong>
          <ul>
            {evaluation.warnings.map((warning) => (
              <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {evaluation.benchmark ? <BenchmarkTable benchmarks={[evaluation.benchmark]} /> : null}
    </>
  )
}

export default function AdminAlgorithmsPage() {
  const scenarios = useApi<ScenariosResponse>('/api/scenarios')
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const scenarioId = selectedScenarioId ?? scenarios.data?.scenarios[0]?.id ?? null

  const snapshot = useApi<SnapshotResponse>(
    scenarioId ? `/api/scenarios/${encodeURIComponent(scenarioId)}/snapshot` : null,
  )

  const [tab, setTab] = useState<TabId>('astar')

  const [fromId, setFromId] = useState<string | null>(null)
  const [toId, setToId] = useState<string | null>(null)
  const [heuristic, setHeuristic] = useState<'projected-distance' | 'zero'>('projected-distance')
  const [astar, setAstar] = useState<AstarEvaluation | null>(null)

  const [maxStates, setMaxStates] = useState('250000')
  const [knapsack, setKnapsack] = useState<AlgorithmEvaluation<KnapsackEvaluationResult> | null>(null)

  const [closest, setClosest] =
    useState<AlgorithmEvaluation<ClosestPairEvaluationResult> | null>(null)

  const [seed, setSeed] = useState('42')
  const [trials, setTrials] = useState('20')
  const [ants, setAnts] = useState('0')
  const [aco, setAco] = useState<AlgorithmEvaluation<AcoEvaluationResult> | null>(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locations = snapshot.data?.snapshot.locations ?? []
  const resolvedFromId = fromId ?? locations[0]?.id ?? ''
  const resolvedToId = toId ?? locations[1]?.id ?? locations[0]?.id ?? ''
  const locationName = new Map(locations.map((entry) => [entry.id, entry.name]))
  const vehicleName = new Map(
    (snapshot.data?.snapshot.vehicles ?? []).map((entry) => [entry.id, entry.name]),
  )

  function resetOutput() {
    setError(null)
    setAstar(null)
    setKnapsack(null)
    setClosest(null)
    setAco(null)
  }

  function changeScenario(nextId: string) {
    setSelectedScenarioId(nextId)
    setFromId(null)
    setToId(null)
    resetOutput()
  }

  async function runAstar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!scenarioId || !resolvedFromId || !resolvedToId) return
    setBusy(true)
    setError(null)
    try {
      const response = await evaluateAstar({
        scenarioId,
        fromLocationId: resolvedFromId,
        toLocationId: resolvedToId,
        heuristic,
      })
      setAstar(response.evaluation)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function runKnapsack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!scenarioId) return
    setBusy(true)
    setError(null)
    try {
      const response = await evaluateKnapsack({
        scenarioId,
        maxStates: Number(maxStates),
      })
      setKnapsack(response.evaluation)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function runClosestPair() {
    if (!scenarioId) return
    setBusy(true)
    setError(null)
    try {
      const response = await evaluateClosestPair({ scenarioId })
      setClosest(response.evaluation)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function runAco(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!scenarioId) return
    setBusy(true)
    setError(null)
    try {
      const response = await evaluateAco({
        scenarioId,
        overrides: {
          aco: { seed: Number(seed), numTrials: Number(trials), numAnts: Number(ants) },
        },
      })
      setAco(response.evaluation)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin workspace"
        title="Algorithm evaluation"
        description="Run each required algorithm against the stored scenario and compare it with its labelled baseline. A* runs directly on the road graph; the others reuse the integrated pipeline so inputs and units match a real run."
      />

      {scenarios.error ? (
        <Card>
          <ErrorState message={scenarios.error} onRetry={scenarios.reload} />
        </Card>
      ) : scenarios.loading && !scenarios.data ? (
        <Card>
          <LoadingRows label="Loading scenarios…" />
        </Card>
      ) : snapshot.error ? (
        <Card>
          <ErrorState message={snapshot.error} onRetry={snapshot.reload} />
        </Card>
      ) : !scenarioId ? (
        <Card>
          <EmptyState title="No scenario is stored" body="Seed the database first." />
        </Card>
      ) : (
        <>
          <Card>
            <div className="opt-form__grid">
              {scenarios.data && scenarios.data.scenarios.length > 1 ? (
                <div className="opt-field">
                  <label htmlFor="alg-scenario">Scenario</label>
                  <select
                    id="alg-scenario"
                    value={scenarioId}
                    onChange={(event) => changeScenario(event.target.value)}
                  >
                    {scenarios.data.scenarios.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="opt-field">
                <span className="opt-field__label">Stored scenario</span>
                <p className="metric-note">
                  {snapshot.loading && !snapshot.data
                    ? 'Loading stored locations and roads…'
                    : `${locations.length} locations · ${
                        snapshot.data?.snapshot.roads.length ?? 0
                      } roads (including closed) · ${
                        snapshot.data?.snapshot.donations.length ?? 0
                      } donations`}
                </p>
              </div>
            </div>
          </Card>

          <div className="tab-row" role="group" aria-label="Algorithm evaluation tabs">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={entry.id === tab ? 'tab is-active' : 'tab'}
                aria-pressed={entry.id === tab}
                onClick={() => {
                  setTab(entry.id)
                  setError(null)
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {error ? (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          ) : null}

          {tab === 'astar' ? (
            <>
              <Card
                title="A* search"
                description="Shortest path through available roads. Closed roads are excluded from the graph. Dijkstra runs on the same graph as the baseline."
              >
                <form className="opt-form" onSubmit={(event) => void runAstar(event)}>
                  <div className="opt-form__grid">
                    <div className="opt-field">
                      <label htmlFor="astar-from">Start location</label>
                      <select
                        id="astar-from"
                        value={resolvedFromId}
                        onChange={(event) => setFromId(event.target.value)}
                      >
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="opt-field">
                      <label htmlFor="astar-to">Goal location</label>
                      <select
                        id="astar-to"
                        value={resolvedToId}
                        onChange={(event) => setToId(event.target.value)}
                      >
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="opt-field">
                      <label htmlFor="astar-heuristic">Heuristic</label>
                      <select
                        id="astar-heuristic"
                        value={heuristic}
                        onChange={(event) =>
                          setHeuristic(event.target.value as 'projected-distance' | 'zero')
                        }
                      >
                        <option value="projected-distance">Projected straight-line</option>
                        <option value="zero">Zero</option>
                      </select>
                    </div>
                  </div>
                  <div className="opt-form__actions">
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={busy || locations.length < 2}
                    >
                      {busy ? 'Searching…' : 'Run A*'}
                    </button>
                    {locations.length < 2 ? (
                      <p className="opt-field__hint">
                        Waiting for the stored locations to load before a path can be searched.
                      </p>
                    ) : null}
                  </div>
                </form>

                {astar ? <AstarResult evaluation={astar} /> : null}
              </Card>
            </>
          ) : null}

          {tab === 'knapsack' ? (
            <Card
              title="Multiple-knapsack DP"
              description="Exact DP over the joint capacity vector. The greedy value-density baseline runs on the same packages and vehicles."
            >
              <form className="opt-form" onSubmit={(event) => void runKnapsack(event)}>
                <div className="opt-form__grid">
                  <div className="opt-field">
                    <label htmlFor="knapsack-states">State limit</label>
                    <input
                      id="knapsack-states"
                      type="number"
                      min={1}
                      max={5000000}
                      value={maxStates}
                      onChange={(event) => setMaxStates(event.target.value)}
                    />
                    <p className="opt-field__hint">
                      Over the limit the endpoint reports an error instead of approximating.
                    </p>
                  </div>
                </div>
                <div className="opt-form__actions">
                  <button type="submit" className="btn-primary" disabled={busy || !scenarioId}>
                    {busy ? 'Solving…' : 'Run DP'}
                  </button>
                </div>
              </form>

              {knapsack ? (
                <div className="evaluation">
                  <EvaluationNotices evaluation={knapsack} />
                  <div className="table-wrap">
                    <table className="data-table">
                      <caption>Allocations from the exact DP</caption>
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
                        {knapsack.result.allocations.map((allocation) => (
                          <tr key={allocation.vehicleId}>
                            <th scope="row">
                              {vehicleName.get(allocation.vehicleId) ?? allocation.vehicleId}
                            </th>
                            <td>{allocation.donationIds.length}</td>
                            <td>
                              {formatInt(allocation.totalWeightUnits)} /{' '}
                              {formatInt(allocation.capacityUnits)} kg
                            </td>
                            <td>{formatNumber(allocation.utilization, 1)}%</td>
                            <td>{formatInt(allocation.totalValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <caption>Unallocated packages</caption>
                      <thead>
                        <tr>
                          <th scope="col">Package</th>
                          <th scope="col">Reason</th>
                          <th scope="col">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {knapsack.result.unallocated.map((entry) => (
                          <tr key={entry.donationId}>
                            <th scope="row">{entry.packageName}</th>
                            <td>
                              <span className={statusClass('infeasible')}>{entry.reason}</span>
                            </td>
                            <td>{entry.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </Card>
          ) : null}

          {tab === 'closest-pair' ? (
            <Card
              title="Divide-and-conquer closest pair"
              description="Straight-line Euclidean distance between projected location coordinates. The brute-force baseline checks every pair on the same points."
            >
              <div className="opt-form__actions">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy || !scenarioId}
                  onClick={() => void runClosestPair()}
                >
                  {busy ? 'Computing…' : 'Run closest pair'}
                </button>
              </div>

              {closest ? (
                <div className="evaluation">
                  <EvaluationNotices evaluation={closest} />
                  {closest.result.closestPair ? (
                    <div className="closest-pair">
                      <p className="closest-pair__value">
                        {closest.result.closestPair.distanceMeters === null
                          ? 'Unavailable'
                          : `${formatNumber(closest.result.closestPair.distanceMeters, 1)} m`}
                      </p>
                      <p>
                        {closest.result.closestPair.p1?.name ?? '—'} ↔{' '}
                        {closest.result.closestPair.p2?.name ?? '—'}
                      </p>
                      <p className="metric-note">{closest.result.closestPair.note}</p>
                      <p className="metric-note">
                        This is straight-line projected distance, not road distance.
                      </p>
                    </div>
                  ) : (
                    <p className="metric-note">Fewer than two locations were available.</p>
                  )}
                </div>
              ) : null}
            </Card>
          ) : null}

          {tab === 'aco' ? (
            <Card
              title="ACO route ordering"
              description="ACO orders the pickup/delivery jobs derived from the current DP allocation. Costs come from A* road paths. Nearest neighbour is the labelled baseline on the same jobs. ACO is a heuristic; no optimality is claimed."
            >
              <form className="opt-form" onSubmit={(event) => void runAco(event)}>
                <div className="opt-form__grid">
                  <div className="opt-field">
                    <label htmlFor="aco-seed">Seed</label>
                    <input
                      id="aco-seed"
                      type="number"
                      min={-1}
                      max={2147483646}
                      value={seed}
                      onChange={(event) => setSeed(event.target.value)}
                    />
                  </div>
                  <div className="opt-field">
                    <label htmlFor="aco-trials">Trials</label>
                    <input
                      id="aco-trials"
                      type="number"
                      min={1}
                      max={10000}
                      value={trials}
                      onChange={(event) => setTrials(event.target.value)}
                    />
                  </div>
                  <div className="opt-field">
                    <label htmlFor="aco-ants">Ants per trial</label>
                    <input
                      id="aco-ants"
                      type="number"
                      min={0}
                      max={1000}
                      value={ants}
                      onChange={(event) => setAnts(event.target.value)}
                    />
                    <p className="opt-field__hint">0 = auto (√jobs, at least 1).</p>
                  </div>
                </div>
                <div className="opt-form__actions">
                  <button type="submit" className="btn-primary" disabled={busy || !scenarioId}>
                    {busy ? 'Searching…' : 'Run ACO'}
                  </button>
                </div>
              </form>

              {aco ? (
                <div className="evaluation">
                  <EvaluationNotices evaluation={aco} />
                  <div className="table-wrap">
                    <table className="data-table">
                      <caption>Routes measured by the run</caption>
                      <thead>
                        <tr>
                          <th scope="col">Vehicle</th>
                          <th scope="col">Status</th>
                          <th scope="col">Cost</th>
                          <th scope="col">Stops</th>
                          <th scope="col">Unreachable jobs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aco.result.routes.map((route) => (
                          <tr key={route.vehicleId}>
                            <th scope="row">{vehicleName.get(route.vehicleId) ?? route.vehicleId}</th>
                            <td>
                              <span className={statusClass(route.status)}>{route.status}</span>
                            </td>
                            <td>
                              {formatNumber(route.totalCost, 2)} {route.costUnit}
                            </td>
                            <td>{route.stops.length}</td>
                            <td>{route.infeasibleReason ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {aco.result.unreachable.length > 0 ? (
                    <div className="table-wrap">
                      <table className="data-table">
                        <caption>Unreachable ordered pairs</caption>
                        <thead>
                          <tr>
                            <th scope="col">From</th>
                            <th scope="col">To</th>
                            <th scope="col">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aco.result.unreachable.map((pair) => (
                            <tr key={`${pair.fromLocationId}-${pair.toLocationId}`}>
                              <th scope="row">{pair.fromName}</th>
                              <td>{pair.toName}</td>
                              <td>{pair.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ) : null}

          <p className="metric-note">
            Selected path preview: {locationName.get(resolvedFromId) ?? '—'} →{' '}
            {locationName.get(resolvedToId) ?? '—'}. Algorithm outputs remain on screen until the
            next evaluation in that tab.
          </p>
        </>
      )}
    </>
  )
}

function AstarResult({ evaluation }: { evaluation: AstarEvaluation }) {
  return (
    <div className="evaluation">
      <p className="metric-note">{evaluation.note}</p>
      <div className="compare-grid">
        <article className="compare-card">
          <h3>A*</h3>
          <p className="compare-card__value">
            {evaluation.astar.reached
              ? `${formatNumber(evaluation.astar.cost ?? 0, 2)} ${evaluation.costUnit}`
              : 'Unreachable'}
          </p>
          <p className="metric-note">
            {evaluation.astar.pathNames.length > 0
              ? evaluation.astar.pathNames.join(' → ')
              : (evaluation.astar.unreachableReason ?? 'No path exists through available roads.')}
          </p>
          <p className="metric-note">
            Nodes expanded: {evaluation.astar.nodesExpanded} · Measured{' '}
            {formatNumber(evaluation.astar.runtimeMs, 2)} ms
          </p>
        </article>
        <article className="compare-card">
          <h3>Dijkstra baseline</h3>
          <p className="compare-card__value">
            {evaluation.dijkstra.reached && evaluation.dijkstra.cost !== null
              ? `${formatNumber(evaluation.dijkstra.cost, 2)} ${evaluation.costUnit}`
              : 'Unreachable'}
          </p>
          <p className="metric-note">
            {evaluation.dijkstra.pathNames.length > 0
              ? evaluation.dijkstra.pathNames.join(' → ')
              : 'No path exists through available roads.'}
          </p>
          <p className="metric-note">
            Nodes expanded: {evaluation.dijkstra.nodesExpanded} · Measured{' '}
            {formatNumber(evaluation.dijkstra.runtimeMs, 2)} ms
          </p>
        </article>
      </div>
    </div>
  )
}

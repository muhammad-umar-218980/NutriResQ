import { lazy, Suspense, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  StatCard,
} from '../../components/app/ui'
import { useApi } from '../../hooks/useApi'
import { ApiError } from '../../lib/api'
import {
  cloneScenario,
  createSensitivityVariant,
  reduceScenarioSupply,
  startOptimization,
  updateScenarioDonation,
  updateScenarioRecipient,
  updateScenarioRoad,
  updateScenarioVehicle,
} from '../../lib/domain-api'
import { formatDateTime } from '../../lib/format'
import type {
  ComparisonResponse,
  DonationRecord,
  DonationStatus,
  MetricDelta,
  RecipientRecord,
  RoadRecord,
  ScenarioChangeRecord,
  ScenarioChangesResponse,
  ScenariosResponse,
  ScenarioSnapshot,
  ScenarioSummary,
  SnapshotResponse,
  RunsResponse,
  StateSpaceInfo,
  VehicleRecord,
} from '../../types/domain'
import './AdminScenario.css'

const ScenarioDeltaChart = lazy(() => import('../../components/charts/ScenarioDeltaChart'))

type EditorTab = 'roads' | 'vehicles' | 'packages' | 'recipients' | 'supply' | 'sensitivity'

const TABS: ReadonlyArray<{ id: EditorTab; label: string }> = [
  { id: 'roads', label: 'Road closures' },
  { id: 'vehicles', label: 'Fleet' },
  { id: 'packages', label: 'Packages' },
  { id: 'recipients', label: 'Recipients' },
  { id: 'supply', label: 'Supply shock' },
  { id: 'sensitivity', label: 'Sensitivity' },
]

function formatInt(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/** Client-side mirror of the server guard: prod(capacity_j + 1) over available vehicles. */
function projectedStates(vehicles: readonly VehicleRecord[]): number {
  return vehicles
    .filter((vehicle) => vehicle.isAvailable)
    .reduce((total, vehicle) => total * (vehicle.capacityUnits + 1), 1)
}

function verdict(delta: MetricDelta): 'better' | 'worse' | 'same' {
  if (Math.abs(delta.delta) < 1e-9) return 'same'
  const improved = delta.lowerIsBetter ? delta.delta < 0 : delta.delta > 0
  return improved ? 'better' : 'worse'
}

function summarizeChange(change: ScenarioChangeRecord): string {
  const keys = [
    'isAvailable',
    'capacityUnits',
    'weightUnits',
    'valueScore',
    'status',
    'priorityScore',
    'demandUnits',
    'percent',
    'totalWeight',
    'affectedCount',
    'name',
    'counts',
  ]

  const describe = (value: Record<string, unknown>): string => {
    const parts = keys
      .filter((key) => value[key] !== undefined)
      .map((key) => `${key}=${String(value[key])}`)
    return parts.length > 0 ? parts.join(', ') : '—'
  }

  return `${describe(change.beforeValue)} → ${describe(change.afterValue)}`
}

export default function AdminScenarioPage() {
  const scenarios = useApi<ScenariosResponse>('/api/scenarios')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const scenarioId = selectedId ?? scenarios.data?.scenarios[0]?.id ?? null
  const scenario = scenarios.data?.scenarios.find((entry) => entry.id === scenarioId) ?? null
  const parentId = scenario?.parentScenarioId ?? null

  const snapshot = useApi<SnapshotResponse>(
    scenarioId ? `/api/scenarios/${encodeURIComponent(scenarioId)}/snapshot` : null,
  )
  const changes = useApi<ScenarioChangesResponse>(
    scenarioId ? `/api/scenarios/${encodeURIComponent(scenarioId)}/changes?limit=50` : null,
  )
  const runs = useApi<RunsResponse>(
    scenarioId ? `/api/scenarios/${encodeURIComponent(scenarioId)}/runs?pageSize=10` : null,
  )
  // A variant is compared with the scenario it was cloned from. A base scenario
  // is compared with its own earlier runs.
  const baseScenarioId = parentId ?? scenarioId
  const baseRuns = useApi<RunsResponse>(
    baseScenarioId ? `/api/scenarios/${encodeURIComponent(baseScenarioId)}/runs?pageSize=10` : null,
  )

  const [tab, setTab] = useState<EditorTab>('roads')
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [cloneName, setCloneName] = useState('')
  const [supplyPercent, setSupplyPercent] = useState('20')
  const [urgencyCount, setUrgencyCount] = useState('3')

  const [maxStates, setMaxStates] = useState('250000')
  const [acoSeed, setAcoSeed] = useState('42')
  const [acoTrials, setAcoTrials] = useState('20')

  const [largeStateRetry, setLargeStateRetry] = useState<{
    vehicleId: string
    patch: { isAvailable?: boolean; capacityUnits?: number }
  } | null>(null)

  const [manualBaseRunId, setManualBaseRunId] = useState('')
  const [manualVariantRunId, setManualVariantRunId] = useState('')
  const baseRunId = manualBaseRunId || baseRuns.data?.runs[0]?.id || ''
  const variantRunId = manualVariantRunId || runs.data?.runs[0]?.id || ''

  const comparison = useApi<ComparisonResponse>(
    scenarioId && baseRunId && variantRunId
      ? `/api/scenarios/${encodeURIComponent(scenarioId)}/compare?baseRunId=${encodeURIComponent(
          baseRunId,
        )}&variantRunId=${encodeURIComponent(variantRunId)}`
      : null,
  )

  function refresh(): void {
    scenarios.reload()
    snapshot.reload()
    changes.reload()
    runs.reload()
    baseRuns.reload()
  }

  async function perform(label: string, action: () => Promise<string | null>): Promise<void> {
    setBusy(label)
    setActionError(null)
    setNotice(null)
    try {
      const message = await action()
      if (message) setNotice(message)
      refresh()
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'That change was rejected.',
      )
    } finally {
      setBusy(null)
    }
  }

  async function applyVehicle(
    vehicleId: string,
    patch: { isAvailable?: boolean; capacityUnits?: number },
    allowLargeStateSpace = false,
  ): Promise<void> {
    if (!scenarioId) return
    setBusy(`vehicle-${vehicleId}`)
    setActionError(null)
    setNotice(null)

    try {
      const response = await updateScenarioVehicle(scenarioId, vehicleId, {
        ...patch,
        ...(allowLargeStateSpace ? { allowLargeStateSpace: true } : {}),
      })

      setLargeStateRetry(null)
      if (!response.changed) {
        setNotice('That vehicle already had those values; nothing was recorded.')
      } else {
        const states = response.stateSpace
          ? ` Exact DP states for the available fleet: ${formatInt(
              response.stateSpace.projectedStateCount,
            )}.`
          : ''
        setNotice(`Vehicle updated.${states}`)
      }
      refresh()
    } catch (error) {
      if (error instanceof ApiError) {
        const details = error.details as { stateSpace?: StateSpaceInfo } | undefined
        if (details?.stateSpace) setLargeStateRetry({ vehicleId, patch })
        setActionError(error.message)
      } else {
        setActionError('The vehicle could not be updated.')
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleClone(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!scenarioId) return

    await perform('clone', async () => {
      const response = await cloneScenario(scenarioId, {
        name: cloneName.trim() || undefined,
      })
      setCloneName('')
      setSelectedId(response.scenario.id)
      return `Cloned into "${response.scenario.name}". The original scenario and its runs are untouched.`
    })
  }

  async function handleRun(): Promise<void> {
    if (!scenarioId) return

    await perform('run', async () => {
      const response = await startOptimization(scenarioId, {
        astarHeuristic: 'projected-distance',
        knapsack: { maxStates: Number(maxStates) },
        aco: { seed: Number(acoSeed), numTrials: Number(acoTrials) },
      })
      const metrics = response.run.metrics
      return metrics
        ? `Run stored with status "${response.run.status}": ${formatInt(
            metrics.allocatedPackageWeightUnits,
          )} kg allocated, ${formatNumber(metrics.vehicleCapacityUtilization, 2)}% utilisation.`
        : `Run stored with status "${response.run.status}".`
    })
  }

  const snapshotData = snapshot.data?.snapshot ?? null
  const vehicles = snapshotData?.vehicles ?? []
  const availableStates = projectedStates(vehicles)

  return (
    <>
      <PageHeader
        eyebrow="Scenario simulator"
        title="What-if scenarios"
        description="Clone the seeded scenario, change one input at a time, run the variant and compare the metrics. Every edit is audited in scenario_changes; the base scenario and its stored runs are never modified."
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
          <EmptyState title="No scenario is stored" body="Seed the database before simulating." />
        </Card>
      ) : (
        <>
          <ScenarioCard
            scenario={scenario}
            scenarios={scenarios.data?.scenarios ?? []}
            parentName={
              parentId
                ? scenarios.data?.scenarios.find((entry) => entry.id === parentId)?.name ?? parentId
                : null
            }
            onScenarioChange={(nextId) => {
              setSelectedId(nextId)
              setManualBaseRunId('')
              setManualVariantRunId('')
              setNotice(null)
              setActionError(null)
            }}
          />

          <Card
            title="Clone this scenario"
            description="The clone copies location links, roads, donors, recipients, packages and vehicles in one transaction. Donor and vehicle portal accounts stay attached to the original rows only."
          >
            <form className="opt-form" onSubmit={(event) => void handleClone(event)}>
              <div className="opt-form__grid">
                <div className="opt-field">
                  <label htmlFor="clone-name">Variant name</label>
                  <input
                    id="clone-name"
                    type="text"
                    maxLength={120}
                    placeholder={`${scenario.name} — variant`}
                    value={cloneName}
                    onChange={(event) => setCloneName(event.target.value)}
                  />
                  <p className="opt-field__hint">
                    Leave blank to use the default name. Variants keep a link to this scenario.
                  </p>
                </div>
              </div>
              <div className="opt-form__actions">
                <button type="submit" className="btn-primary" disabled={busy !== null}>
                  {busy === 'clone' ? 'Cloning…' : 'Clone scenario'}
                </button>
              </div>
            </form>
          </Card>

          {actionError ? (
            <p className="notice notice--error" role="alert">
              {actionError}
              {largeStateRetry ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="btn-secondary btn-secondary--small"
                    onClick={() => {
                      void applyVehicle(
                        largeStateRetry.vehicleId,
                        largeStateRetry.patch,
                        true,
                      )
                    }}
                    disabled={busy !== null}
                  >
                    Apply anyway
                  </button>
                </>
              ) : null}
            </p>
          ) : null}

          {notice ? (
            <p className="notice notice--success" role="status">
              {notice}
            </p>
          ) : null}

          <div className="stat-grid">
            <StatCard
              label="Available vehicles"
              value={`${vehicles.filter((vehicle) => vehicle.isAvailable).length} / ${vehicles.length}`}
              hint={`${formatInt(availableStates)} exact DP states`}
            />
            <StatCard
              label="Open roads"
              value={`${(snapshotData?.roads ?? []).filter((road) => road.isAvailable).length} / ${
                (snapshotData?.roads ?? []).length
              }`}
              hint="Closed roads stay stored and are excluded from the run graph"
            />
            <StatCard
              label="Audited edits"
              value={changes.data?.changes.length ?? 0}
              hint="Rows in scenario_changes for this scenario"
            />
            <StatCard
              label="Stored runs"
              value={scenario.counts.runs}
              hint="Results are replayed from result_json, never recomputed"
            />
          </div>

          <Card
            title="Run this variant"
            description="Parameters are recorded with the run. Keep them identical when comparing variants so the delta reflects the scenario edit, not the search settings."
          >
            <div className="opt-form__grid">
              <div className="opt-field">
                <label htmlFor="sim-max-states">Knapsack state limit</label>
                <input
                  id="sim-max-states"
                  type="number"
                  min={1}
                  max={5000000}
                  value={maxStates}
                  onChange={(event) => setMaxStates(event.target.value)}
                />
                <p className="opt-field__hint">
                  Default 250,000. Raise it only when the fleet guard says the state space is
                  larger.
                </p>
              </div>
              <div className="opt-field">
                <label htmlFor="sim-seed">ACO seed</label>
                <input
                  id="sim-seed"
                  type="number"
                  min={-1}
                  max={2147483646}
                  value={acoSeed}
                  onChange={(event) => setAcoSeed(event.target.value)}
                />
              </div>
              <div className="opt-field">
                <label htmlFor="sim-trials">ACO trials</label>
                <input
                  id="sim-trials"
                  type="number"
                  min={1}
                  max={10000}
                  value={acoTrials}
                  onChange={(event) => setAcoTrials(event.target.value)}
                />
              </div>
            </div>
            <div className="opt-form__actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleRun()}
                disabled={busy !== null}
              >
                {busy === 'run' ? 'Running…' : 'Run variant'}
              </button>
              <p className="opt-field__hint">
                The exact DP keeps the allocation optimal for the edited inputs. ACO stays a
                heuristic.
              </p>
            </div>
          </Card>

          {snapshot.error ? (
            <Card>
              <ErrorState message={snapshot.error} onRetry={snapshot.reload} />
            </Card>
          ) : !snapshotData ? (
            <Card>
              <LoadingRows label="Loading scenario inputs…" />
            </Card>
          ) : (
            <Card
              title="Scenario edits"
              description="Each control writes one scenario_changes row. A no-op is reported as unchanged and records nothing."
            >
              <div className="tab-row" role="tablist" aria-label="Scenario edit type">
                {TABS.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === entry.id}
                    className={tab === entry.id ? 'tab is-active' : 'tab'}
                    onClick={() => setTab(entry.id)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>

              {tab === 'roads' ? (
                <RoadEditor
                  snapshot={snapshotData}
                  disabled={busy !== null}
                  onToggle={(road) =>
                    void perform(`road-${road.id}`, async () => {
                      const response = await updateScenarioRoad(
                        snapshotData.scenarioId,
                        road.id,
                        !road.isAvailable,
                      )
                      return response.changed
                        ? `Road ${response.road?.isAvailable ? 'reopened' : 'closed'}.`
                        : 'That road already had that state.'
                    })
                  }
                />
              ) : null}

              {tab === 'vehicles' ? (
                <VehicleEditor
                  vehicles={vehicles}
                  disabled={busy !== null}
                  busy={busy}
                  onApply={(vehicleId, patch) => void applyVehicle(vehicleId, patch)}
                />
              ) : null}

              {tab === 'packages' ? (
                <DonationEditor
                  donations={snapshotData.donations}
                  disabled={busy !== null}
                  onSave={(donation, patch) =>
                    void perform(`donation-${donation.id}`, async () => {
                      const response = await updateScenarioDonation(
                        snapshotData.scenarioId,
                        donation.id,
                        patch,
                      )
                      return response.changed
                        ? `"${donation.packageName}" updated.`
                        : 'Those values were already stored.'
                    })
                  }
                />
              ) : null}

              {tab === 'recipients' ? (
                <RecipientEditor
                  recipients={snapshotData.recipients}
                  disabled={busy !== null}
                  onSave={(recipient, patch) =>
                    void perform(`recipient-${recipient.id}`, async () => {
                      const response = await updateScenarioRecipient(
                        snapshotData.scenarioId,
                        recipient.id,
                        patch,
                      )
                      return response.changed
                        ? `"${recipient.name}" updated. Packages for an unavailable recipient are excluded from allocation.`
                        : 'Those values were already stored.'
                    })
                  }
                />
              ) : null}

              {tab === 'supply' ? (
                <div className="sim-panel">
                  <p className="metric-note">
                    Reduce every package weight by a percentage. This models a supply shock and
                    writes one audit row with the totals before and after.
                  </p>
                  <div className="opt-field opt-field--inline">
                    <label htmlFor="supply-percent">Reduction (%)</label>
                    <input
                      id="supply-percent"
                      type="number"
                      min={1}
                      max={100}
                      value={supplyPercent}
                      onChange={(event) => setSupplyPercent(event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy !== null}
                      onClick={() =>
                        void perform('supply', async () => {
                          const response = await reduceScenarioSupply(
                            snapshotData.scenarioId,
                            Number(supplyPercent),
                          )
                          return `Supply reduced by ${response.summary.percent}%: ${formatInt(
                            response.summary.totalWeightBefore,
                          )} kg → ${formatInt(response.summary.totalWeightAfter)} kg across ${
                            response.summary.affectedCount
                          } package(s).`
                        })
                      }
                    >
                      {busy === 'supply' ? 'Applying…' : 'Reduce supply'}
                    </button>
                  </div>
                </div>
              ) : null}

              {tab === 'sensitivity' ? (
                <div className="sim-panel">
                  <p className="metric-note">
                    Creates a new clone with the N most urgent recipients marked unavailable. The
                    current scenario is not modified; run the new variant and compare it to measure
                    the cost of serving without them.
                  </p>
                  <div className="opt-field opt-field--inline">
                    <label htmlFor="urgency-count">Recipients to remove</label>
                    <input
                      id="urgency-count"
                      type="number"
                      min={1}
                      max={10}
                      value={urgencyCount}
                      onChange={(event) => setUrgencyCount(event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy !== null}
                      onClick={() =>
                        void perform('sensitivity', async () => {
                          const response = await createSensitivityVariant(
                            snapshotData.scenarioId,
                            Number(urgencyCount),
                          )
                          setSelectedId(response.scenario.id)
                          setManualBaseRunId('')
                          setManualVariantRunId('')
                          return `Created "${response.scenario.name}" with ${
                            response.disabledRecipients.length
                          } recipient(s) removed: ${response.disabledRecipients
                            .map((entry) => entry.name)
                            .join(', ')}.`
                        })
                      }
                    >
                      {busy === 'sensitivity' ? 'Creating…' : 'Create sensitivity variant'}
                    </button>
                  </div>
                </div>
              ) : null}
            </Card>
          )}

          <Card
            title="Base run vs variant run"
            description="Pick one stored run from each side. Deltas are computed from stored metrics; nothing is recomputed."
          >
            <div className="sim-compare-controls">
              <div className="opt-field">
                <label htmlFor="base-run">
                  Base run {parentId ? '(from the parent scenario)' : '(earlier run of this scenario)'}
                </label>
                <select
                  id="base-run"
                  value={baseRunId}
                  onChange={(event) => setManualBaseRunId(event.target.value)}
                >
                  {baseRuns.data?.runs.length ? (
                    baseRuns.data.runs.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {formatDateTime(entry.startedAt)} · {entry.status} ·{' '}
                        {entry.metrics ? `${formatInt(entry.metrics.allocatedPackageWeightUnits)} kg` : 'no metrics'}
                      </option>
                    ))
                  ) : (
                    <option value="">No stored run</option>
                  )}
                </select>
              </div>

              <div className="opt-field">
                <label htmlFor="variant-run">Variant run</label>
                <select
                  id="variant-run"
                  value={variantRunId}
                  onChange={(event) => setManualVariantRunId(event.target.value)}
                >
                  {runs.data?.runs.length ? (
                    runs.data.runs.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {formatDateTime(entry.startedAt)} · {entry.status} ·{' '}
                        {entry.metrics ? `${formatInt(entry.metrics.allocatedPackageWeightUnits)} kg` : 'no metrics'}
                      </option>
                    ))
                  ) : (
                    <option value="">No stored run</option>
                  )}
                </select>
              </div>
            </div>

            {comparison.error ? (
              <p className="notice notice--error" role="alert">
                {comparison.error}
              </p>
            ) : comparison.data ? (
              <>
                <Suspense
                  fallback={
                    <div className="chart-canvas" role="status">
                      Loading chart…
                    </div>
                  }
                >
                  <ScenarioDeltaChart comparison={comparison.data.comparison} />
                </Suspense>
                <ComparisonTable comparison={comparison.data.comparison} />
              </>
            ) : (
              <p className="metric-note">
                Run this scenario (and, for a variant, keep a run on the parent) to unlock the
                comparison.
              </p>
            )}
          </Card>

          <Card
            title="Audit trail"
            description="One row per accepted edit. Rejected and no-op edits write nothing."
          >
            {changes.error ? (
              <ErrorState message={changes.error} onRetry={changes.reload} />
            ) : changes.loading && !changes.data ? (
              <LoadingRows label="Loading audit trail…" />
            ) : changes.data && changes.data.changes.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <caption>scenario_changes for this scenario</caption>
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Change</th>
                      <th scope="col">Target</th>
                      <th scope="col">Before → after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.data.changes.map((change) => (
                      <tr key={change.id}>
                        <td>{formatDateTime(change.createdAt)}</td>
                        <td>
                          <span className="pill pill--neutral">{change.changeType}</span>
                        </td>
                        <td>{change.targetEntityType}</td>
                        <td>
                          <span className="sim-change">{summarizeChange(change)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="metric-note">
                No edits are recorded yet. Clone this scenario, then change a road, vehicle,
                package or recipient.
              </p>
            )}
          </Card>
        </>
      )}
    </>
  )
}

function ScenarioCard({
  scenario,
  scenarios,
  parentName,
  onScenarioChange,
}: {
  scenario: ScenarioSummary
  scenarios: ScenarioSummary[]
  parentName: string | null
  onScenarioChange: (id: string) => void
}) {
  return (
    <Card
      title={scenario.name}
      description={scenario.description ?? undefined}
      actions={
        <div className="opt-field opt-field--inline">
          <label htmlFor="sim-scenario">Scenario</label>
          <select
            id="sim-scenario"
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
          <strong>{scenario.counts.donations}</strong> packages
        </span>
        <span>
          <strong>{scenario.counts.vehicles}</strong> vehicles
        </span>
        <span>
          <strong>{scenario.counts.runs}</strong> stored runs
        </span>
        {parentName ? <span>Cloned from: {parentName}</span> : null}
        <span className={`pill pill--${scenario.status === 'archived' ? 'suspended' : 'active'}`}>
          {scenario.status}
        </span>
      </div>
    </Card>
  )
}

function ComparisonTable({ comparison }: { comparison: ComparisonResponse['comparison'] }) {
  return (
    <div className="sim-comparison">
      <div className="table-wrap">
        <table className="data-table">
          <caption>
            Base run {comparison.base.id.slice(0, 8)} ({comparison.base.status}) vs variant run{' '}
            {comparison.variant.id.slice(0, 8)} ({comparison.variant.status})
          </caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Base</th>
              <th scope="col">Variant</th>
              <th scope="col">Delta</th>
              <th scope="col">Change</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {comparison.deltas.map((delta) => {
              const outcome = verdict(delta)
              return (
                <tr key={delta.metric}>
                  <th scope="row">{delta.label}</th>
                  <td>
                    {formatNumber(delta.base, delta.unit === '%' ? 2 : 0)} {delta.unit}
                  </td>
                  <td>
                    {formatNumber(delta.variant, delta.unit === '%' ? 2 : 0)} {delta.unit}
                  </td>
                  <td>
                    {delta.delta > 0 ? '+' : ''}
                    {formatNumber(delta.delta, delta.unit === '%' ? 2 : 0)}
                  </td>
                  <td>
                    {delta.deltaPercent === null
                      ? '—'
                      : `${delta.deltaPercent > 0 ? '+' : ''}${formatNumber(delta.deltaPercent, 1)}%`}
                  </td>
                  <td>
                    <span className={`pill sim-verdict sim-verdict--${outcome}`}>{outcome}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ul className="sim-notes">
        {comparison.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  )
}

function RoadEditor({
  snapshot,
  disabled,
  onToggle,
}: {
  snapshot: ScenarioSnapshot
  disabled: boolean
  onToggle: (road: RoadRecord) => void
}) {
  const nameOf = new Map(snapshot.locations.map((location) => [location.id, location.name]))

  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Toggle a road closure. Closed roads stay in the data but leave the run graph.</caption>
        <thead>
          <tr>
            <th scope="col">Road</th>
            <th scope="col">Cost</th>
            <th scope="col">State</th>
            <th scope="col" className="data-table__actions">
              <span className="visually-hidden">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {snapshot.roads.map((road) => (
            <tr key={road.id}>
              <th scope="row">
                {nameOf.get(road.fromLocationId) ?? road.fromLocationId} ↔{' '}
                {nameOf.get(road.toLocationId) ?? road.toLocationId}
              </th>
              <td>
                {formatNumber(road.cost, 1)} {road.costUnit}
              </td>
              <td>
                <span className={`pill pill--${road.isAvailable ? 'active' : 'suspended'}`}>
                  {road.isAvailable ? 'open' : 'closed'}
                </span>
              </td>
              <td className="data-table__actions">
                <button
                  type="button"
                  className="btn-secondary btn-secondary--small"
                  disabled={disabled}
                  onClick={() => onToggle(road)}
                >
                  {road.isAvailable ? 'Close road' : 'Reopen road'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VehicleEditor({
  vehicles,
  disabled,
  busy,
  onApply,
}: {
  vehicles: VehicleRecord[]
  disabled: boolean
  busy: string | null
  onApply: (
    vehicleId: string,
    patch: { isAvailable?: boolean; capacityUnits?: number },
  ) => void
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>
          Fleet available to the exact DP. Disabling a vehicle shrinks the state space; enabling
          one grows it.
        </caption>
        <thead>
          <tr>
            <th scope="col">Vehicle</th>
            <th scope="col">Capacity (kg)</th>
            <th scope="col">State</th>
            <th scope="col" className="data-table__actions">
              <span className="visually-hidden">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle) => (
            <VehicleRow
              key={`${vehicle.id}-${vehicle.capacityUnits}-${vehicle.isAvailable}`}
              vehicle={vehicle}
              disabled={disabled}
              saving={busy === `vehicle-${vehicle.id}`}
              onApply={onApply}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VehicleRow({
  vehicle,
  disabled,
  saving,
  onApply,
}: {
  vehicle: VehicleRecord
  disabled: boolean
  saving: boolean
  onApply: (
    vehicleId: string,
    patch: { isAvailable?: boolean; capacityUnits?: number },
  ) => void
}) {
  const [capacity, setCapacity] = useState(String(vehicle.capacityUnits))

  const nextCapacity = Number(capacity)
  const capacityDirty = Number.isInteger(nextCapacity) && nextCapacity !== vehicle.capacityUnits

  return (
    <tr>
      <th scope="row">{vehicle.name}</th>
      <td>
        <input
          type="number"
          min={1}
          max={5000}
          value={capacity}
          aria-label={`Capacity for ${vehicle.name}`}
          className="sim-input"
          onChange={(event) => setCapacity(event.target.value)}
          disabled={disabled}
        />
        {capacityDirty ? (
          <button
            type="button"
            className="btn-secondary btn-secondary--small"
            disabled={disabled}
            onClick={() => onApply(vehicle.id, { capacityUnits: nextCapacity })}
          >
            Save
          </button>
        ) : null}
      </td>
      <td>
        <span className={`pill pill--${vehicle.isAvailable ? 'active' : 'suspended'}`}>
          {vehicle.isAvailable ? 'available' : 'disabled'}
        </span>
      </td>
      <td className="data-table__actions">
        <button
          type="button"
          className="btn-secondary btn-secondary--small"
          disabled={disabled}
          onClick={() => onApply(vehicle.id, { isAvailable: !vehicle.isAvailable })}
        >
          {saving ? 'Saving…' : vehicle.isAvailable ? 'Disable' : 'Enable'}
        </button>
      </td>
    </tr>
  )
}

function DonationEditor({
  donations,
  disabled,
  onSave,
}: {
  donations: DonationRecord[]
  disabled: boolean
  onSave: (
    donation: DonationRecord,
    patch: { weightUnits?: number; valueScore?: number; status?: DonationStatus },
  ) => void
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Package-level edits. Weight is an integer number of kilograms.</caption>
        <thead>
          <tr>
            <th scope="col">Package</th>
            <th scope="col">Weight (kg)</th>
            <th scope="col">Value</th>
            <th scope="col">Status</th>
            <th scope="col" className="data-table__actions">
              <span className="visually-hidden">Save</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {donations.map((donation) => (
            <DonationRow
              key={`${donation.id}-${donation.weightUnits}-${donation.valueScore}-${donation.status}`}
              donation={donation}
              disabled={disabled}
              onSave={onSave}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DonationRow({
  donation,
  disabled,
  onSave,
}: {
  donation: DonationRecord
  disabled: boolean
  onSave: (
    donation: DonationRecord,
    patch: { weightUnits?: number; valueScore?: number; status?: DonationStatus },
  ) => void
}) {
  const [weight, setWeight] = useState(String(donation.weightUnits))
  const [value, setValue] = useState(String(donation.valueScore))
  const [status, setStatus] = useState<DonationStatus>(donation.status)

  const dirty =
    Number(weight) !== donation.weightUnits ||
    Number(value) !== donation.valueScore ||
    status !== donation.status

  return (
    <tr>
      <th scope="row">
        {donation.packageName}
        <span className="data-table__sub">
          {donation.recipientId ? `priority ${donation.recipientPriority}` : 'no intended recipient'}
        </span>
      </th>
      <td>
        <input
          type="number"
          min={1}
          max={100000}
          className="sim-input"
          aria-label={`Weight for ${donation.packageName}`}
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          disabled={disabled}
        />
      </td>
      <td>
        <input
          type="number"
          min={0}
          max={100}
          className="sim-input"
          aria-label={`Value score for ${donation.packageName}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
        />
      </td>
      <td>
        <select
          className="sim-input"
          aria-label={`Status for ${donation.packageName}`}
          value={status}
          onChange={(event) => setStatus(event.target.value as DonationStatus)}
          disabled={disabled}
        >
          <option value="available">available</option>
          <option value="unavailable">unavailable</option>
          <option value="reserved">reserved</option>
          <option value="expired">expired</option>
        </select>
      </td>
      <td className="data-table__actions">
        <button
          type="button"
          className="btn-secondary btn-secondary--small"
          disabled={!dirty || disabled}
          onClick={() =>
            onSave(donation, {
              weightUnits: Number(weight),
              valueScore: Number(value),
              status,
            })
          }
        >
          Save
        </button>
      </td>
    </tr>
  )
}

function RecipientEditor({
  recipients,
  disabled,
  onSave,
}: {
  recipients: RecipientRecord[]
  disabled: boolean
  onSave: (
    recipient: RecipientRecord,
    patch: { demandUnits?: number; priorityScore?: number; isAvailable?: boolean },
  ) => void
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>
          Priority multiplies the DP objective (value_score × priority). Unavailable recipients
          exclude their packages from allocation.
        </caption>
        <thead>
          <tr>
            <th scope="col">Recipient</th>
            <th scope="col">Demand (informational)</th>
            <th scope="col">Priority</th>
            <th scope="col">State</th>
            <th scope="col" className="data-table__actions">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {recipients.map((recipient) => (
            <RecipientRow
              key={`${recipient.id}-${recipient.demandUnits}-${recipient.priorityScore}-${recipient.isAvailable}`}
              recipient={recipient}
              disabled={disabled}
              onSave={onSave}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RecipientRow({
  recipient,
  disabled,
  onSave,
}: {
  recipient: RecipientRecord
  disabled: boolean
  onSave: (
    recipient: RecipientRecord,
    patch: { demandUnits?: number; priorityScore?: number; isAvailable?: boolean },
  ) => void
}) {
  const [demand, setDemand] = useState(String(recipient.demandUnits))
  const [priority, setPriority] = useState(String(recipient.priorityScore))

  const dirty =
    Number(demand) !== recipient.demandUnits || Number(priority) !== recipient.priorityScore

  return (
    <tr>
      <th scope="row">{recipient.name}</th>
      <td>
        <input
          type="number"
          min={0}
          max={100000}
          className="sim-input"
          aria-label={`Demand for ${recipient.name}`}
          value={demand}
          onChange={(event) => setDemand(event.target.value)}
          disabled={disabled}
        />
      </td>
      <td>
        <input
          type="number"
          min={0}
          max={100}
          className="sim-input"
          aria-label={`Priority for ${recipient.name}`}
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          disabled={disabled}
        />
      </td>
      <td>
        <span className={`pill pill--${recipient.isAvailable ? 'active' : 'suspended'}`}>
          {recipient.isAvailable ? 'available' : 'unavailable'}
        </span>
      </td>
      <td className="data-table__actions">
        <button
          type="button"
          className="btn-secondary btn-secondary--small"
          disabled={!dirty || disabled}
          onClick={() =>
            onSave(recipient, {
              demandUnits: Number(demand),
              priorityScore: Number(priority),
            })
          }
        >
          Save
        </button>
        <button
          type="button"
          className="btn-secondary btn-secondary--small"
          disabled={disabled}
          onClick={() => onSave(recipient, { isAvailable: !recipient.isAvailable })}
        >
          {recipient.isAvailable ? 'Mark unavailable' : 'Mark available'}
        </button>
      </td>
    </tr>
  )
}

import type { BenchmarkRecord } from '../../types/domain'

function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(3)
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    // Named records (locations, packages) read better than raw JSON.
    if (typeof record.name === 'string') return record.name
    return JSON.stringify(value)
  }
  return String(value)
}

function labelOf(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (character) => character.toUpperCase())
    .replace(/\bDp\b/g, 'DP')
    .replace(/\bAco\b/g, 'ACO')
    .replace(/\bMs\b/g, 'ms')
}

export default function BenchmarkTable({ benchmarks }: { benchmarks: BenchmarkRecord[] }) {
  if (benchmarks.length === 0) {
    return <p className="metric-note">No benchmark records were returned for this run.</p>
  }

  return (
    <div className="benchmark-list">
      {benchmarks.map((benchmark) => {
        const vehicles = benchmark.resultSummary.vehicles
        const summaryEntries = Object.entries(benchmark.resultSummary).filter(
          ([key]) => key !== 'vehicles',
        )

        return (
          <article className="benchmark" key={`${benchmark.algorithmName}-${benchmark.trialNumber}`}>
            <header className="benchmark__head">
              <div>
                <h3>{benchmark.algorithmName}</h3>
                <p className="benchmark__baseline">
                  Baseline: {benchmark.baselineName ?? 'none'} · Trial {benchmark.trialNumber}
                </p>
              </div>
              <p className="benchmark__runtime">
                Measured {benchmark.runtimeMs.toFixed(1)} ms
              </p>
            </header>

            <dl className="benchmark__summary">
              {summaryEntries.map(([key, value]) => (
                <div key={key}>
                  <dt>{labelOf(key)}</dt>
                  <dd>{formatValue(value)}</dd>
                </div>
              ))}
            </dl>

            {Array.isArray(vehicles) && vehicles.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <caption>Per-vehicle measurement on the same jobs and cost source</caption>
                  <thead>
                    <tr>
                      <th scope="col">Vehicle</th>
                      <th scope="col">Jobs</th>
                      <th scope="col">ACO cost</th>
                      <th scope="col">Nearest-neighbour cost</th>
                      <th scope="col">ACO feasible</th>
                      <th scope="col">Baseline feasible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((raw, index) => {
                      const vehicle = raw as Record<string, unknown>
                      return (
                        <tr key={String(vehicle.vehicleId ?? index)}>
                          <th scope="row">{String(vehicle.vehicleName ?? '—')}</th>
                          <td>{formatValue(vehicle.jobCount)}</td>
                          <td>{formatValue(vehicle.acoTotalCost)}</td>
                          <td>{formatValue(vehicle.nearestNeighborTotalCost)}</td>
                          <td>{formatValue(vehicle.acoFeasible)}</td>
                          <td>{formatValue(vehicle.nearestNeighborFeasible)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

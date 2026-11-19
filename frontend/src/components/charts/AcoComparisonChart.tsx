import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_COLOURS, chartNumber, useReducedMotion } from './chartSupport'
import './charts.css'
import type { AcoEvaluationResult, AlgorithmEvaluation } from '../../types/domain'

/**
 * ACO best tour versus the nearest-neighbour baseline, one pair of bars per
 * vehicle.
 *
 * The numbers are read from the ACO benchmark record the evaluation already
 * carries (`resultSummary.vehicles`), so the chart cannot drift from the
 * measured run. `TourSpreadTable` next to it keeps the exact values, including
 * average and worst tours.
 */

interface VehicleComparison {
  name: string
  aco: number
  nearest: number
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readVehicles(
  evaluation: AlgorithmEvaluation<AcoEvaluationResult>,
): VehicleComparison[] {
  const summary = evaluation.benchmark?.resultSummary
  const raw = summary?.vehicles
  if (!Array.isArray(raw)) return []

  const rows: VehicleComparison[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const name = typeof record.vehicleName === 'string' ? record.vehicleName : null
    const aco = toNumber(record.acoBestTourCost)
    const nearest = toNumber(record.nearestNeighborTotalCost)
    if (!name || aco === null || nearest === null) continue
    rows.push({ name, aco, nearest })
  }
  return rows
}

export default function AcoComparisonChart({
  evaluation,
}: {
  evaluation: AlgorithmEvaluation<AcoEvaluationResult>
}) {
  const reducedMotion = useReducedMotion()
  const vehicles = readVehicles(evaluation)

  if (vehicles.length === 0) {
    return (
      <p className="metric-note">
        No per-vehicle ACO and nearest-neighbour costs were returned, so there is nothing to chart.
        The per-vehicle table below still reports the measured routes.
      </p>
    )
  }

  const unit = evaluation.result.metrics.totalRoadCostUnit || 'km'
  const summary = evaluation.benchmark?.resultSummary
  const fleetAco = toNumber(summary?.acoTotalCost)
  const fleetNearest = toNumber(summary?.nearestNeighborTotalCost)

  const ariaLabel = [
    `ACO best tour versus nearest neighbour, road cost in ${unit}.`,
    ...vehicles.map(
      (vehicle) =>
        `${vehicle.name}: ACO ${chartNumber(vehicle.aco)} versus nearest neighbour ${chartNumber(
          vehicle.nearest,
        )}.`,
    ),
    fleetAco !== null && fleetNearest !== null
      ? `Fleet total: ACO ${chartNumber(fleetAco)} versus nearest neighbour ${chartNumber(
          fleetNearest,
        )}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <figure className="chart-figure">
      <figcaption className="chart-caption">
        <strong>ACO versus nearest neighbour, per vehicle</strong>
        <span>
          Best ACO tour against the labelled nearest-neighbour baseline on the same pickup and
          delivery jobs. Costs are A* road distances in {unit}.
          {fleetAco !== null && fleetNearest !== null ? (
            <>
              {' '}
              Fleet total: <strong>{chartNumber(fleetAco)}</strong> versus{' '}
              <strong>{chartNumber(fleetNearest)}</strong> {unit}.
            </>
          ) : null}
        </span>
      </figcaption>

      <div className="chart-canvas" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={vehicles} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={CHART_COLOURS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={{ stroke: CHART_COLOURS.axis }}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fontSize: 12 }}
              label={{
                value: unit,
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11, fill: CHART_COLOURS.tertiary },
              }}
            />
            <Tooltip
              cursor={{ fill: 'rgba(65, 74, 48, 0.06)' }}
              formatter={(value: unknown, name: unknown) => [
                `${chartNumber(Number(value))} ${unit}`,
                String(name ?? ''),
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="aco"
              name="ACO best tour"
              fill={CHART_COLOURS.primary}
              radius={[3, 3, 0, 0]}
              isAnimationActive={!reducedMotion}
            />
            <Bar
              dataKey="nearest"
              name="Nearest neighbour"
              fill={CHART_COLOURS.secondary}
              radius={[3, 3, 0, 0]}
              isAnimationActive={!reducedMotion}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

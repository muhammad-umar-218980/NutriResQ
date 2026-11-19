import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_COLOURS, chartNumber, useReducedMotion } from './chartSupport'
import './charts.css'
import type { MetricDelta, RunComparison } from '../../types/domain'

/**
 * Base run versus variant run for the two metrics that carry the simulator's
 * story: measured road cost and allocated humanitarian value.
 *
 * Values come straight from `comparison.deltas`, so the bars and the delta
 * table below always agree. Metrics with different units get their own panel
 * instead of a shared axis.
 */

const CHARTED_METRICS = ['totalRoadCost', 'allocatedPackageValue'] as const

const METRIC_COPY: Record<string, { title: string; description: string }> = {
  totalRoadCost: {
    title: 'Measured road cost',
    description: 'Total A* road distance across every required route.',
  },
  allocatedPackageValue: {
    title: 'Allocated humanitarian value',
    description: 'Objective value of the packages the DP assigned (value score × priority).',
  },
}

function digitsFor(value: number): number {
  return Math.abs(value) >= 1000 ? 0 : 2
}

function deltaText(delta: MetricDelta): string {
  const sign = delta.delta > 0 ? '+' : ''
  const percent =
    delta.deltaPercent === null
      ? ''
      : ` (${delta.deltaPercent > 0 ? '+' : ''}${chartNumber(delta.deltaPercent, 1)}%)`
  return `${sign}${chartNumber(delta.delta, digitsFor(delta.delta))} ${delta.unit}${percent}`
}

function MetricPanel({
  delta,
  reducedMotion,
}: {
  delta: MetricDelta
  reducedMotion: boolean
}) {
  const copy = METRIC_COPY[delta.metric] ?? { title: delta.label, description: '' }
  const data = [
    { name: 'Base run', value: delta.base, colour: CHART_COLOURS.secondary },
    { name: 'Variant run', value: delta.variant, colour: CHART_COLOURS.primary },
  ]
  const ariaLabel = `${copy.title} in ${delta.unit}. Base run ${chartNumber(
    delta.base,
    digitsFor(delta.base),
  )}, variant run ${chartNumber(delta.variant, digitsFor(delta.variant))}, change ${deltaText(
    delta,
  )}.`

  return (
    <figure className="chart-panel">
      <figcaption>
        <strong>{copy.title}</strong>
        <span>
          {copy.description} Change: <strong>{deltaText(delta)}</strong>.
          {delta.lowerIsBetter ? ' Lower is better.' : ''}
        </span>
      </figcaption>

      <div className="chart-canvas" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
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
              width={64}
              tick={{ fontSize: 12 }}
              tickFormatter={(value: number) => chartNumber(value, digitsFor(value))}
              label={{
                value: delta.unit,
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11, fill: CHART_COLOURS.tertiary },
              }}
            />
            <Tooltip
              cursor={{ fill: 'rgba(65, 74, 48, 0.06)' }}
              formatter={(value: unknown) => [
                `${chartNumber(Number(value), digitsFor(Number(value)))} ${delta.unit}`,
                delta.label,
              ]}
            />
            <Bar dataKey="value" name={delta.label} radius={[3, 3, 0, 0]} isAnimationActive={!reducedMotion}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.colour} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

export default function ScenarioDeltaChart({ comparison }: { comparison: RunComparison }) {
  const reducedMotion = useReducedMotion()
  const deltas = CHARTED_METRICS.map((metric) =>
    comparison.deltas.find((delta) => delta.metric === metric),
  ).filter((delta): delta is MetricDelta => delta !== undefined)

  if (deltas.length === 0) {
    return (
      <p className="metric-note">
        Road cost and allocated value were not returned for this comparison, so there is nothing to
        chart. The table below still lists every tracked metric.
      </p>
    )
  }

  return (
    <div className="chart-stack">
      <div className="chart-grid">
        {deltas.map((delta) => (
          <MetricPanel key={delta.metric} delta={delta} reducedMotion={reducedMotion} />
        ))}
      </div>
    </div>
  )
}

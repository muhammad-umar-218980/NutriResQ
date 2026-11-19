import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SCALE_BENCHMARK_ROWS } from '../../data/scaleBenchmarks'
import { CHART_COLOURS, chartNumber, useReducedMotion } from './chartSupport'
import './charts.css'

/**
 * Runtime versus input size for each algorithm family, measured by
 * `backend/src/bench/scale.ts` (`npm run bench:export`) on deterministic
 * synthetic instances.
 *
 * Each family gets its own panel because the x axes are different units
 * (road nodes, projected points, packages, delivery jobs). Putting them on one
 * axis would imply a comparison that was never measured. The stored run below
 * remains the source for the demo scenario's own benchmark numbers.
 */

interface SeriesConfig {
  key: string
  label: string
  colour: string
}

interface PanelConfig {
  title: string
  subtitle: string
  xLabel: string
  algorithms: SeriesConfig[]
  /** Brute force spans two orders of magnitude, so its panel uses a log axis. */
  logY?: boolean
}

interface Point {
  size: number
  [algorithm: string]: number
}

const PANELS: PanelConfig[] = [
  {
    title: 'A* vs Dijkstra',
    subtitle: 'Corner-to-corner searches on a square grid; Dijkstra is the zero-heuristic baseline.',
    xLabel: 'road nodes',
    algorithms: [
      { key: 'astar', label: 'A*', colour: CHART_COLOURS.primary },
      { key: 'dijkstra', label: 'Dijkstra', colour: CHART_COLOURS.muted },
    ],
  },
  {
    title: 'Closest pair: divide and conquer vs brute force',
    subtitle: 'Random projected points; the brute-force baseline checks every pair.',
    xLabel: 'projected points',
    algorithms: [
      { key: 'closest-pair-dc', label: 'Divide and conquer', colour: CHART_COLOURS.primary },
      { key: 'closest-pair-brute', label: 'Brute force', colour: CHART_COLOURS.secondary },
    ],
    logY: true,
  },
  {
    title: 'Multiple-knapsack DP',
    subtitle: 'Exact DP over a three-vehicle capacity vector; runtime grows with the state space.',
    xLabel: 'packages',
    algorithms: [{ key: 'multiple-knapsack-dp', label: 'DP', colour: CHART_COLOURS.tertiary }],
  },
  {
    title: 'ACO route ordering',
    subtitle: 'Twenty seeded trials; runtime is search time, not solution quality.',
    xLabel: 'delivery jobs',
    algorithms: [{ key: 'aco', label: 'ACO', colour: CHART_COLOURS.secondary }],
  },
]

function pointsFor(config: PanelConfig): Point[] {
  const keys = new Set(config.algorithms.map((entry) => entry.key))
  const bySize = new Map<number, Point>()

  for (const row of SCALE_BENCHMARK_ROWS) {
    if (row.metric !== 'runtime' || row.size === null) continue
    if (!keys.has(row.algorithm) || typeof row.value !== 'number') continue

    const point = bySize.get(row.size) ?? { size: row.size }
    point[row.algorithm] = row.value
    bySize.set(row.size, point)
  }

  return [...bySize.values()].sort((a, b) => a.size - b.size)
}

function formatMs(value: number): string {
  return value < 10 ? `${chartNumber(value, 2)} ms` : `${chartNumber(value, 0)} ms`
}

function ScalePanel({
  config,
  points,
  reducedMotion,
}: {
  config: PanelConfig
  points: Point[]
  reducedMotion: boolean
}) {
  const ariaLabel = [
    `${config.title}, runtime in milliseconds versus ${config.xLabel}.`,
    ...points.map(
      (point) =>
        `${point.size} ${config.xLabel}: ` +
        config.algorithms
          .map((series) => `${series.label} ${formatMs(point[series.key] ?? 0)}`)
          .join(', ') +
        '.',
    ),
  ].join(' ')

  return (
    <figure className="chart-panel">
      <figcaption>
        <strong>{config.title}</strong>
        <span>{config.subtitle}</span>
      </figcaption>

      <div className="chart-canvas" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={CHART_COLOURS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="size"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={points.map((point) => point.size)}
              tickLine={false}
              axisLine={{ stroke: CHART_COLOURS.axis }}
              tick={{ fontSize: 12 }}
              label={{
                value: config.xLabel,
                position: 'insideBottom',
                offset: -2,
                style: { fontSize: 11, fill: CHART_COLOURS.tertiary },
              }}
            />
            <YAxis
              scale={config.logY ? 'log' : 'linear'}
              domain={config.logY ? ['auto', 'auto'] : [0, 'auto']}
              allowDataOverflow={false}
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fontSize: 12 }}
              tickFormatter={(value: number) => chartNumber(value, value < 10 ? 1 : 0)}
              label={{
                value: 'ms',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11, fill: CHART_COLOURS.tertiary },
              }}
            />
            <Tooltip
              formatter={(value: unknown, name: unknown) => [
                formatMs(Number(value)),
                String(name ?? ''),
              ]}
              labelFormatter={(value) => `${value} ${config.xLabel}`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {config.algorithms.map((series) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.colour}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: series.colour }}
                activeDot={{ r: 4 }}
                connectNulls
                isAnimationActive={!reducedMotion}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

export default function BenchmarkScalingChart() {
  const reducedMotion = useReducedMotion()

  return (
    <div className="chart-stack">
      <p className="chart-note">
        Wall-clock runtime against input size on deterministic synthetic instances. Each panel has
        its own input axis, so panels are not compared with each other. Times are machine-specific;
        run <code>npm run bench:export</code> in <code>backend</code> to regenerate them.
      </p>

      <div className="chart-grid">
        {PANELS.map((config) => (
          <ScalePanel
            key={config.title}
            config={config}
            points={pointsFor(config)}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>
    </div>
  )
}

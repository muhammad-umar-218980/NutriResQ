import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { AstarEvaluation, LocationRecord, ScenarioSnapshot } from '../../types/domain'

/**
 * OpenStreetMap view of one A* search against the stored scenario.
 *
 * The basemap is real geography (stored latitude/longitude), so with Karachi
 * coordinates this is a Karachi map. The two lines are the location sequences
 * returned by the API: Dijkstra underneath as a grey halo, A* on top in green.
 * Where the lines coincide the grey halo is the visual proof that both
 * algorithms agree; where they diverge the grey branch is the path A* skipped.
 *
 * Street geometry is not stored, so the lines follow the road graph, not
 * turn-by-turn roads. If the tile server is unreachable the component falls
 * back to `AstarSchematic`, which needs no network.
 */

const ROAD_AVAILABLE_COLOUR = '#d3cec0'
const ROAD_CLOSED_COLOUR = '#a4472b'
const DIJKSTRA_COLOUR = '#3f3b33'
const ASTAR_COLOUR = '#2f7d32'

const TILE_ERRORS_BEFORE_FALLBACK = 4
const DRAW_DURATION_MS = 1200

type Point = [number, number]

interface AstarRouteMapProps {
  snapshot: ScenarioSnapshot
  evaluation: AstarEvaluation
}

function pathPoints(
  path: string[],
  locationById: Map<string, LocationRecord>,
): Point[] {
  const points: Point[] = []
  for (const locationId of path) {
    const location = locationById.get(locationId)
    if (location) points.push([location.latitude, location.longitude])
  }
  return points
}

/** Popup body built from DOM nodes so stored names are never parsed as HTML. */
function createPopup(title: string, lines: string[]): HTMLElement {
  const root = document.createElement('div')
  root.className = 'route-map__popup'

  const heading = document.createElement('strong')
  heading.textContent = title
  root.append(heading)

  for (const line of lines) {
    const span = document.createElement('span')
    span.textContent = line
    root.append(span)
  }

  return root
}

/** Fractions of total length at which each point of the path is reached. */
function lengthFractions(points: Point[]): number[] {
  const distances: number[] = [0]
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    const [lat1, lng1] = points[index - 1]
    const [lat2, lng2] = points[index]
    const scale = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180)
    total += Math.hypot((lng2 - lng1) * scale, lat2 - lat1)
    distances.push(total)
  }
  if (total === 0) return distances.map(() => 0)
  return distances.map((distance) => distance / total)
}

/** The part of the path covered at `progress` in [0, 1]. */
function partialPoints(points: Point[], fractions: number[], progress: number): Point[] {
  if (points.length < 2 || progress >= 1) return points

  const drawn: Point[] = [points[0]]
  for (let index = 1; index < points.length; index += 1) {
    if (fractions[index] <= progress) {
      drawn.push(points[index])
      continue
    }
    const span = fractions[index] - fractions[index - 1]
    const local = span > 0 ? (progress - fractions[index - 1]) / span : 1
    const t = Math.min(1, Math.max(0, local))
    const [lat1, lng1] = points[index - 1]
    const [lat2, lng2] = points[index]
    drawn.push([lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t])
    break
  }
  return drawn
}

function pinIcon(className: string, label: string): L.DivIcon {
  return L.divIcon({
    className: `astar-pin ${className}`,
    html: `<span>${label}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function AstarSchematic({
  snapshot,
  evaluation,
}: {
  snapshot: ScenarioSnapshot
  evaluation: AstarEvaluation
}) {
  const locations = snapshot.locations
  if (locations.length === 0) {
    return <p className="metric-note">No stored locations to draw.</p>
  }

  const width = 760
  const height = 460
  const pad = 40
  const xs = locations.map((location) => location.projectedX)
  const ys = locations.map((location) => location.projectedY)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY)
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2

  const locationById = new Map(locations.map((location) => [location.id, location]))

  const project = (locationId: string) => {
    const location = locationById.get(locationId)
    if (!location) return null
    return {
      x: offsetX + (location.projectedX - minX) * scale,
      y: height - offsetY - (location.projectedY - minY) * scale,
    }
  }

  const segments = (path: string[]) => {
    const lines: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> = []
    for (let index = 1; index < path.length; index += 1) {
      const from = project(path[index - 1])
      const to = project(path[index])
      if (!from || !to) continue
      lines.push({
        key: `${path[index - 1]}-${path[index]}-${index}`,
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
      })
    }
    return lines
  }

  const start = project(evaluation.from.id)
  const goal = project(evaluation.to.id)

  return (
    <figure className="schematic">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Schematic of the A* and Dijkstra paths over the stored road graph"
      >
        <title>A* route schematic</title>

        {snapshot.roads.map((road) => {
          const from = project(road.fromLocationId)
          const to = project(road.toLocationId)
          if (!from || !to) return null
          return (
            <line
              key={road.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={
                road.isAvailable ? 'schematic__road' : 'schematic__road schematic__road--closed'
              }
            />
          )
        })}

        {segments(evaluation.dijkstra.path).map(({ key, ...line }) => (
          <line key={`dijkstra-${key}`} {...line} className="schematic__leg schematic__leg--dijkstra" />
        ))}

        {segments(evaluation.astar.path).map(({ key, ...line }) => (
          <line key={`astar-${key}`} {...line} className="schematic__leg schematic__leg--astar" />
        ))}

        {start ? <circle cx={start.x} cy={start.y} r={7} className="schematic__pin schematic__pin--start" /> : null}
        {goal ? <circle cx={goal.x} cy={goal.y} r={7} className="schematic__pin schematic__pin--goal" /> : null}
      </svg>

      <figcaption>
        <span className="schematic__legend-title">Schematic</span>
        <span className="schematic__legend-item">
          <span className="schematic__swatch schematic__swatch--astar" aria-hidden="true" /> A* path
        </span>
        <span className="schematic__legend-item">
          <span className="schematic__swatch schematic__swatch--dijkstra" aria-hidden="true" /> Dijkstra path
        </span>
        <span className="schematic__legend-item">
          <span className="schematic__swatch schematic__swatch--closed" aria-hidden="true" /> Closed road
        </span>
        <span className="schematic__note">
          Basemap tiles could not be reached, so this schematic is drawn from the stored projection.
        </span>
      </figcaption>
    </figure>
  )
}

export default function AstarRouteMap({ snapshot, evaluation }: AstarRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const replayRef = useRef<() => void>(() => {})
  const [seenEvaluation, setSeenEvaluation] = useState(evaluation)
  const [tilesFailed, setTilesFailed] = useState(false)

  // A new search should retry the basemap instead of staying on the fallback.
  if (seenEvaluation !== evaluation) {
    setSeenEvaluation(evaluation)
    setTilesFailed(false)
  }
  const [reducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (tilesFailed) return

    const container = containerRef.current
    if (!container) return

    if (mapRef.current) {
      try {
        mapRef.current.remove()
      } catch {
        // Already detached by a previous teardown.
      }
      mapRef.current = null
    }

    const locations = snapshot.locations
    if (locations.length === 0) return

    const locationById = new Map(locations.map((location) => [location.id, location]))
    const astarPoints = pathPoints(evaluation.astar.path, locationById)
    const dijkstraPoints = pathPoints(evaluation.dijkstra.path, locationById)

    const map = L.map(container, {
      scrollWheelZoom: false,
      zoomControl: true,
    })
    mapRef.current = map

    let tileErrors = 0
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    })
    tiles.on('tileerror', () => {
      tileErrors += 1
      if (tileErrors >= TILE_ERRORS_BEFORE_FALLBACK) setTilesFailed(true)
    })
    tiles.addTo(map)
    L.control.scale({ imperial: false }).addTo(map)

    // 1. The stored road graph: faint when available, dashed red when closed.
    for (const road of snapshot.roads) {
      const from = locationById.get(road.fromLocationId)
      const to = locationById.get(road.toLocationId)
      if (!from || !to) continue

      L.polyline(
        [
          [from.latitude, from.longitude],
          [to.latitude, to.longitude],
        ],
        road.isAvailable
          ? { color: ROAD_AVAILABLE_COLOUR, weight: 1.5, opacity: 0.9 }
          : { color: ROAD_CLOSED_COLOUR, weight: 2, opacity: 0.9, dashArray: '6 5' },
      )
        .bindTooltip(
          `${road.isAvailable ? 'Available road' : 'Closed road'} · ${road.cost.toFixed(2)} ${
            road.costUnit
          }`,
          { sticky: true },
        )
        .addTo(map)
    }

    // 2. Dijkstra first, as a wide grey halo under the green A* line.
    if (dijkstraPoints.length >= 2) {
      L.polyline(dijkstraPoints, {
        color: DIJKSTRA_COLOUR,
        weight: 8,
        opacity: 0.5,
        lineCap: 'round',
        interactive: false,
      }).addTo(map)
    }

    // 3. A* on top: bold green, drawn progressively from start to goal.
    const fractions = lengthFractions(astarPoints)
    const astarLine = L.polyline(astarPoints.length >= 2 ? [astarPoints[0]] : astarPoints, {
      color: ASTAR_COLOUR,
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(map)

    const head =
      astarPoints.length >= 2
        ? L.circleMarker(astarPoints[0], {
            radius: 6,
            color: '#ffffff',
            weight: 2,
            fillColor: ASTAR_COLOUR,
            fillOpacity: 1,
            interactive: false,
          }).addTo(map)
        : null

    let frame = 0
    let running = false

    const drawFull = () => {
      if (astarPoints.length >= 2) astarLine.setLatLngs(astarPoints)
      head?.remove()
    }

    const play = () => {
      if (running) return
      if (astarPoints.length < 2 || reducedMotion) {
        drawFull()
        return
      }

      running = true
      const startedAt = performance.now()
      head?.setLatLng(astarPoints[0])

      const step = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / DRAW_DURATION_MS)
        const drawn = partialPoints(astarPoints, fractions, progress)
        astarLine.setLatLngs(drawn)
        head?.setLatLng(drawn[drawn.length - 1])
        if (progress < 1) {
          frame = requestAnimationFrame(step)
        } else {
          running = false
          drawFull()
        }
      }

      frame = requestAnimationFrame(step)
    }

    replayRef.current = play
    play()

    // 4. Every stored location stays clickable; start and goal get numbered pins.
    for (const location of locations) {
      const isStart = location.id === evaluation.from.id
      const isGoal = location.id === evaluation.to.id
      if (isStart || isGoal) continue

      L.circleMarker([location.latitude, location.longitude], {
        radius: 5,
        color: '#ffffff',
        weight: 1.5,
        fillColor: '#8f897a',
        fillOpacity: 0.95,
      })
        .bindPopup(
          createPopup(location.name, [
            location.locationType,
            `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
          ]),
        )
        .bindTooltip(location.name, { direction: 'top', offset: [0, -6] })
        .addTo(map)
    }

    const startLocation = locationById.get(evaluation.from.id)
    if (startLocation) {
      L.marker([startLocation.latitude, startLocation.longitude], {
        icon: pinIcon('astar-pin--start', '1'),
        title: `Start: ${startLocation.name}`,
        zIndexOffset: 1000,
      })
        .bindPopup(createPopup(startLocation.name, ['Start location', evaluation.from.id]))
        .addTo(map)
    }

    const goalLocation = locationById.get(evaluation.to.id)
    if (goalLocation) {
      L.marker([goalLocation.latitude, goalLocation.longitude], {
        icon: pinIcon('astar-pin--goal', '2'),
        title: `Goal: ${goalLocation.name}`,
        zIndexOffset: 1000,
      })
        .bindPopup(createPopup(goalLocation.name, ['Goal location', evaluation.to.id]))
        .addTo(map)
    }

    // 5. Frame the route when there is one, otherwise the whole stored graph.
    const framed = [...astarPoints, ...dijkstraPoints]
    const bounds = L.latLngBounds(
      (framed.length > 0 ? framed : locations.map((location) => [location.latitude, location.longitude] as Point)),
    )
    if (framed.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 })
    } else {
      map.setView(bounds.getCenter(), 13)
    }

    const sizeFrame = requestAnimationFrame(() => map.invalidateSize())

    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(sizeFrame)
      if (mapRef.current === map) mapRef.current = null
      try {
        map.remove()
      } catch {
        // Already removed; keep teardown idempotent.
      }
    }
  }, [snapshot, evaluation, tilesFailed, reducedMotion])

  if (snapshot.locations.length === 0) {
    return <p className="metric-note">No stored locations to draw.</p>
  }

  if (tilesFailed) {
    return <AstarSchematic snapshot={snapshot} evaluation={evaluation} />
  }

  const canReplay = evaluation.astar.reached && evaluation.astar.path.length > 1 && !reducedMotion

  return (
    <figure className="route-map astar-map">
      <div
        ref={containerRef}
        className="route-map__canvas"
        role="region"
        aria-label="Karachi map of the A* path and the Dijkstra baseline"
      />

      <figcaption className="route-map__legend">
        <span className="route-map__legend-title">A* route</span>

        <span className="route-map__legend-item">
          <span className="route-map__swatch route-map__swatch--astar" aria-hidden="true" /> A* path
          (green)
        </span>
        <span className="route-map__legend-item">
          <span className="route-map__swatch route-map__swatch--dijkstra" aria-hidden="true" />{' '}
          Dijkstra path (grey halo)
        </span>
        <span className="route-map__legend-item">
          <span className="route-map__swatch route-map__swatch--road" aria-hidden="true" /> Available
          road
        </span>
        <span className="route-map__legend-item">
          <span className="route-map__swatch route-map__swatch--closed" aria-hidden="true" /> Closed
          road (excluded from the run graph)
        </span>
        <span className="route-map__legend-item">
          <span className="astar-pin astar-pin--start astar-pin--inline" aria-hidden="true">
            <span>1</span>
          </span>
          Start
        </span>
        <span className="route-map__legend-item">
          <span className="astar-pin astar-pin--goal astar-pin--inline" aria-hidden="true">
            <span>2</span>
          </span>
          Goal
        </span>

        {canReplay ? (
          <button
            type="button"
            className="btn-secondary btn-secondary--small astar-map__replay"
            onClick={() => replayRef.current()}
          >
            Replay draw
          </button>
        ) : null}

        <span className="route-map__note">
          Lines follow the stored A* location sequence over the road graph, not turn-by-turn street
          geometry. Where the green line sits inside the grey halo, A* and Dijkstra chose the same
          path. Basemap tiles © OpenStreetMap contributors.
        </span>
      </figcaption>
    </figure>
  )
}

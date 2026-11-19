import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { indexRoads, pathPoints, roadPoints } from './routeGeometry'
import type { ScenarioSnapshot, VehicleRoute } from '../../types/domain'

/**
 * OpenStreetMap view of the stored scenario and the computed route legs.
 *
 * The basemap is real geography (stored latitude/longitude). The route polylines
 * follow the A* node sequence stored in `leg.path`, and each leg between two
 * nodes is drawn along the baked street geometry of that road, so the line hugs
 * the streets instead of cutting straight between pins. When the tile server is
 * unreachable the caller falls back to `RouteSchematic`, which needs no network.
 */

const ROUTE_COLOURS = ['#98482d', '#414a30', '#858c65', '#292a24', '#b85c38']

const LOCATION_STYLE: Record<string, { colour: string; label: string }> = {
  hub: { colour: '#292a24', label: 'Hub / depot' },
  donor: { colour: '#98482d', label: 'Donor' },
  recipient: { colour: '#414a30', label: 'Recipient' },
  other: { colour: '#a39d8c', label: 'Other location' },
}

/** One broken tile is noise; a handful means the tile server is unreachable. */
const TILE_ERRORS_BEFORE_FALLBACK = 4

interface RouteMapProps {
  snapshot: ScenarioSnapshot
  routes: VehicleRoute[]
  /** Called once per mount when the tile server keeps failing. */
  onTilesUnavailable?: () => void
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

function formatCost(value: number, unit: string): string {
  return `${value.toFixed(2)} ${unit}`
}

export default function RouteMap({ snapshot, routes, onTilesUnavailable }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // StrictMode remounts effects. Drop any map that still owns this container
    // before initialising, instead of letting Leaflet throw on a reused node.
    if (mapRef.current) {
      try {
        mapRef.current.remove()
      } catch {
        // Already detached by a previous teardown; nothing left to release.
      }
      mapRef.current = null
    }

    const locations = snapshot.locations
    if (locations.length === 0) return

    const locationById = new Map(locations.map((location) => [location.id, location]))
    const roadIndex = indexRoads(snapshot.roads)
    const vehicleName = new Map(snapshot.vehicles.map((vehicle) => [vehicle.id, vehicle.name]))

    // Every stop each vehicle makes, so a location popup can say who visits it.
    const visits = new Map<
      string,
      Array<{ vehicle: string; sequence: number; stopType: string; cost: number | null }>
    >()
    for (const route of routes) {
      if (route.status === 'not_required') continue
      for (const stop of route.stops) {
        const list = visits.get(stop.locationId) ?? []
        list.push({
          vehicle: vehicleName.get(route.vehicleId) ?? route.vehicleId,
          sequence: stop.sequenceNumber,
          stopType: stop.stopType,
          cost: stop.legCostFromPrevious,
        })
        visits.set(stop.locationId, list)
      }
    }

    const map = L.map(container, {
      scrollWheelZoom: false,
      zoomControl: true,
    })
    mapRef.current = map

    let tileErrors = 0
    let reportedFailure = false
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    })
    tiles.on('tileerror', () => {
      tileErrors += 1
      if (tileErrors >= TILE_ERRORS_BEFORE_FALLBACK && !reportedFailure) {
        reportedFailure = true
        onTilesUnavailable?.()
      }
    })
    tiles.addTo(map)

    // 1. The closed road network, so unavailable links stay visible.
    for (const road of snapshot.roads) {
      const from = locationById.get(road.fromLocationId)
      const to = locationById.get(road.toLocationId)
      if (!from || !to) continue

      L.polyline(
        roadPoints(road, from, to),
        road.isAvailable
          ? { color: '#c9c4b4', weight: 2, opacity: 0.9 }
          : { color: '#a4472b', weight: 2, opacity: 0.85, dashArray: '6 5' },
      )
        .bindTooltip(
          `${road.isAvailable ? 'Available road' : 'Closed road'} · ${formatCost(
            road.cost,
            road.costUnit,
          )}`,
          { sticky: true },
        )
        .addTo(map)
    }

    // 2. Computed legs, drawn along the A* path where it is stored.
    const requiredRoutes = routes.filter((route) => route.status !== 'not_required')
    requiredRoutes.forEach((route, index) => {
      const colour = ROUTE_COLOURS[index % ROUTE_COLOURS.length]
      const name = vehicleName.get(route.vehicleId) ?? route.vehicleId

      for (const leg of route.legs) {
        let points = pathPoints(leg.path, locationById, roadIndex)
        if (points.length < 2) {
          const from = locationById.get(leg.fromLocationId)
          const to = locationById.get(leg.toLocationId)
          if (!from || !to) continue
          points = [
            [from.latitude, from.longitude],
            [to.latitude, to.longitude],
          ]
        }

        L.polyline(points, {
          color: colour,
          weight: 4,
          opacity: 0.9,
          dashArray: route.status === 'partial' ? '8 6' : undefined,
        })
          .bindPopup(
            createPopup(`${name} · ${route.status}`, [
              `${locationById.get(leg.fromLocationId)?.name ?? leg.fromLocationId} → ${
                locationById.get(leg.toLocationId)?.name ?? leg.toLocationId
              }`,
              `Leg cost ${formatCost(leg.cost, route.costUnit)}`,
              `Route total ${formatCost(route.totalCost, route.costUnit)}`,
            ]),
          )
          .bindTooltip(`${name} · ${formatCost(leg.cost, route.costUnit)}`, { sticky: true })
          .addTo(map)
      }
    })

    // 3. Location markers, colour-coded by stored location type.
    for (const location of locations) {
      const style = LOCATION_STYLE[location.locationType] ?? LOCATION_STYLE.other
      const lines = [
        style.label,
        `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
      ]

      const stops = visits.get(location.id) ?? []
      if (stops.length > 0) {
        for (const stop of stops) {
          lines.push(
            `${stop.vehicle} · stop ${stop.sequence} (${stop.stopType})${
              stop.cost === null ? '' : ` · +${formatCost(stop.cost, 'km')}`
            }`,
          )
        }
      }

      L.circleMarker([location.latitude, location.longitude], {
        radius: 6.5,
        color: '#ffffff',
        weight: 1.5,
        fillColor: style.colour,
        fillOpacity: 1,
      })
        .bindPopup(createPopup(location.name, lines))
        .bindTooltip(location.name, { direction: 'top', offset: [0, -6] })
        .addTo(map)
    }

    // 4. Frame the scenario.
    const bounds = L.latLngBounds(
      locations.map((location) => [location.latitude, location.longitude] as [number, number]),
    )
    if (locations.length === 1) {
      map.setView(bounds.getCenter(), 14)
    } else {
      map.fitBounds(bounds, { padding: [26, 26], maxZoom: 15 })
    }

    // The card is laid out after the effect runs in some browsers.
    const frame = requestAnimationFrame(() => map.invalidateSize())

    return () => {
      cancelAnimationFrame(frame)
      if (mapRef.current === map) mapRef.current = null
      try {
        map.remove()
      } catch {
        // Already removed; keep teardown idempotent.
      }
    }
  }, [snapshot, routes, onTilesUnavailable])

  if (snapshot.locations.length === 0) {
    return <p className="metric-note">No stored locations to draw.</p>
  }

  const requiredRoutes = routes.filter((route) => route.status !== 'not_required')
  const vehicleName = new Map(snapshot.vehicles.map((vehicle) => [vehicle.id, vehicle.name]))
  const presentTypes = Array.from(
    new Set(snapshot.locations.map((location) => location.locationType)),
  )

  return (
    <figure className="route-map">
      <div
        ref={containerRef}
        className="route-map__canvas"
        role="region"
        aria-label="Map of stored locations, available and closed roads, and computed route legs"
      />

      <figcaption className="route-map__legend">
        <span className="route-map__legend-title">Map</span>

        <span className="route-map__legend-item">
          <span className="route-map__swatch route-map__swatch--road" aria-hidden="true" /> Available
          road
        </span>
        <span className="route-map__legend-item">
          <span className="route-map__swatch route-map__swatch--closed" aria-hidden="true" /> Closed
          road (excluded from the run graph)
        </span>

        {presentTypes.map((type) => {
          const style = LOCATION_STYLE[type] ?? LOCATION_STYLE.other
          return (
            <span className="route-map__legend-item" key={type}>
              <span
                className="route-map__swatch route-map__swatch--dot"
                style={{ background: style.colour }}
                aria-hidden="true"
              />
              {style.label}
            </span>
          )
        })}

        {requiredRoutes.map((route, index) => (
          <span className="route-map__legend-item" key={route.vehicleId}>
            <span
              className="route-map__swatch"
              style={{ background: ROUTE_COLOURS[index % ROUTE_COLOURS.length] }}
              aria-hidden="true"
            />
            {vehicleName.get(route.vehicleId) ?? route.vehicleId}
            {route.status === 'partial' ? ' (dashed: partial)' : ''}
          </span>
        ))}

        <span className="route-map__note">
          Polylines follow the stored A* location sequence, drawn along each road&apos;s street
          geometry, so they run along roads rather than straight between pins. Click a marker or
          line for costs and stops. Basemap tiles © OpenStreetMap contributors. Page scrolling is
          not hijacked: zoom with the map buttons.
        </span>
      </figcaption>
    </figure>
  )
}

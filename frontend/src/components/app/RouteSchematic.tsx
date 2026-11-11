import type { ScenarioSnapshot, VehicleRoute } from '../../types/domain'

/**
 * Dependency-free schematic of the stored locations and computed route legs.
 *
 * Positions come from the backend's equirectangular projection of each
 * location. Legs are drawn as straight lines between stops because the database
 * stores road costs, not road geometry. This is explicitly a schematic, not a
 * road-distance map.
 */

const WIDTH = 760
const HEIGHT = 460
const PAD = 40
const ROUTE_COLOURS = ['#98482d', '#414a30', '#858c65', '#292a24', '#b85c38']

interface RouteSchematicProps {
  snapshot: ScenarioSnapshot
  routes: VehicleRoute[]
}

export default function RouteSchematic({ snapshot, routes }: RouteSchematicProps) {
  const locations = snapshot.locations
  if (locations.length === 0) {
    return <p className="metric-note">No stored locations to draw.</p>
  }

  const xs = locations.map((location) => location.projectedX)
  const ys = locations.map((location) => location.projectedY)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)
  const scale = Math.min((WIDTH - PAD * 2) / spanX, (HEIGHT - PAD * 2) / spanY)
  const offsetX = (WIDTH - spanX * scale) / 2
  const offsetY = (HEIGHT - spanY * scale) / 2

  const locationById = new Map(locations.map((location) => [location.id, location]))
  const vehicleName = new Map(snapshot.vehicles.map((vehicle) => [vehicle.id, vehicle.name]))

  const project = (locationId: string) => {
    const location = locationById.get(locationId)
    if (!location) return null
    return {
      x: offsetX + (location.projectedX - minX) * scale,
      y: HEIGHT - offsetY - (location.projectedY - minY) * scale,
    }
  }

  const requiredRoutes = routes.filter((route) => route.status !== 'not_required')

  return (
    <figure className="schematic">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Schematic of stored locations, available and closed roads, and computed route legs"
      >
        <title>Route schematic</title>

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
              className={road.isAvailable ? 'schematic__road' : 'schematic__road schematic__road--closed'}
            />
          )
        })}

        {requiredRoutes.map((route, index) => {
          const colour = ROUTE_COLOURS[index % ROUTE_COLOURS.length]
          return (
            <g key={route.vehicleId}>
              {route.legs.map((leg, legIndex) => {
                const from = project(leg.fromLocationId)
                const to = project(leg.toLocationId)
                if (!from || !to) return null
                return (
                  <line
                    key={`${route.vehicleId}-${legIndex}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={colour}
                    className="schematic__leg"
                  />
                )
              })}
            </g>
          )
        })}

        {locations.map((location) => {
          const point = project(location.id)
          if (!point) return null
          return (
            <g key={location.id}>
              <circle cx={point.x} cy={point.y} r={5} className="schematic__location" />
              <title>{location.name}</title>
            </g>
          )
        })}
      </svg>

      <figcaption>
        <span className="schematic__legend-title">Schematic</span>
        <span className="schematic__legend-item">
          <span className="schematic__swatch schematic__swatch--road" aria-hidden="true" /> Available road
        </span>
        <span className="schematic__legend-item">
          <span className="schematic__swatch schematic__swatch--closed" aria-hidden="true" /> Closed road
          (excluded from the run graph)
        </span>
        {requiredRoutes.map((route, index) => (
          <span className="schematic__legend-item" key={route.vehicleId}>
            <span
              className="schematic__swatch"
              style={{ background: ROUTE_COLOURS[index % ROUTE_COLOURS.length] }}
              aria-hidden="true"
            />
            {vehicleName.get(route.vehicleId) ?? route.vehicleId}
          </span>
        ))}
        <span className="schematic__note">
          Straight lines join stored stop locations; road geometry is not stored, so this is not a
          road-distance map.
        </span>
      </figcaption>
    </figure>
  )
}

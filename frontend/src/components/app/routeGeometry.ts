import type { LocationRecord, RoadRecord } from '../../types/domain'

/**
 * Turns a sequence of stored locations into a street-following polyline.
 *
 * Each stored road carries the real driving geometry between its two endpoints
 * (`RoadRecord.geometry`, baked once in the database). Concatenating those
 * per-road polylines in route order gives a line that hugs the streets instead
 * of cutting straight between pins, while the route itself stays the same
 * 28-node path the algorithms produce.
 *
 * Roads without geometry degrade to a straight line between their endpoints, so
 * a freshly created road still draws correctly.
 */

export type Point = [number, number]

function roadKey(fromLocationId: string, toLocationId: string): string {
  return `${fromLocationId}|${toLocationId}`
}

/** Directed lookup, so a bidirectional road resolves from either end. */
export function indexRoads(roads: RoadRecord[]): Map<string, RoadRecord> {
  const index = new Map<string, RoadRecord>()

  for (const road of roads) {
    index.set(roadKey(road.fromLocationId, road.toLocationId), road)
    if (road.isBidirectional) index.set(roadKey(road.toLocationId, road.fromLocationId), road)
  }

  return index
}

/**
 * Polyline for a single road, oriented from the location the route leaves to
 * the one it arrives at. The stored geometry runs from `road.fromLocationId`,
 * so travelling the other way reverses it.
 */
export function roadPoints(
  road: RoadRecord,
  from: LocationRecord,
  to: LocationRecord,
): Point[] {
  const geometry = road.geometry
  if (!geometry || geometry.length < 2) {
    return [
      [from.latitude, from.longitude],
      [to.latitude, to.longitude],
    ]
  }

  return road.fromLocationId === from.id ? geometry.slice() : [...geometry].reverse()
}

/** Street polyline for a stored location path (see the module comment). */
export function pathPoints(
  path: string[],
  locationById: Map<string, LocationRecord>,
  roadIndex: Map<string, RoadRecord>,
): Point[] {
  const points: Point[] = []

  for (let index = 0; index < path.length; index += 1) {
    const location = locationById.get(path[index])
    if (!location) continue

    const previous = index > 0 ? locationById.get(path[index - 1]) : undefined
    const road = previous ? roadIndex.get(roadKey(previous.id, location.id)) : undefined

    if (!previous || !road) {
      points.push([location.latitude, location.longitude])
      continue
    }

    // The leg already starts on this location, so skip its first point.
    for (const point of roadPoints(road, previous, location).slice(1)) points.push(point)
  }

  return points
}

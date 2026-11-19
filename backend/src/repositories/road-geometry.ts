/**
 * `roads.geometry` is jsonb, so pg hands back whatever was stored. Anything that
 * is not a list of finite `[lat, lon]` pairs degrades to null, which makes the
 * maps fall back to a straight line between the road's endpoints instead of
 * throwing while rendering.
 */
export function toPolyline(value: unknown): [number, number][] | null {
  if (!Array.isArray(value) || value.length < 2) return null;

  const points: [number, number][] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [lat, lon] = entry as unknown[];
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    points.push([lat, lon]);
  }

  return points;
}

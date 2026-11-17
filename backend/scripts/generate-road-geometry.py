#!/usr/bin/env python3
"""Bake real Karachi street geometry for every seeded road.

The demo graph has 28 locations and 62 synthetic roads, so drawing a road as a
single two-point line cuts straight across blocks. This script replaces each of
those 62 chords with the actual driving route between the two landmarks, from
the public OSRM demo server (OpenStreetMap data, no key required).

The generated artifact is committed (`backend/src/db/seed-road-geometry.ts`), so
the app never calls OSRM at runtime. Re-run only if the landmark coordinates or
the road list change:

    python backend/scripts/generate-road-geometry.py

Network access is needed *only* while regenerating. The response cache in
`--cache-dir` makes a rerun free and reproducible.

Each polyline is prepended/appended with the exact landmark coordinate, so the
line always starts and ends on the map pin. The leftover leg is the OSRM snap
distance (measured 12-59 m for these 28 pins) and is counted in `distanceKm`,
because a driver really does cover it.

Why OSRM and not the local 48k-node graph: that extract is clipped to
lat <= 24.95, and one seeded landmark (Nagan Chowrangi, 24.955) is outside it.
OSRM also snaps to the nearest road segment rather than the nearest junction,
which keeps the pin-to-road gap small for the medical-centre pins.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SEED = REPO_ROOT / "backend" / "src" / "db" / "seed-data.ts"
DEFAULT_OUT = REPO_ROOT / "backend" / "src" / "db" / "seed-road-geometry.ts"
DEFAULT_CACHE = Path.home() / ".cache" / "nutriresq-road-geometry"

OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
# OSRM refuses a route when a pin snaps further than this from any road.
MAX_SNAP_M = 150.0
EARTH_RADIUS_KM = 6371.0088


def to_radians(degrees: float) -> float:
    return degrees * math.pi / 180.0


def great_circle_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(to_radians, a)
    lat2, lon2 = map(to_radians, b)
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(h)))


def parse_seed(path: Path) -> tuple[list[tuple[str, float, float]], list[tuple[str, int, int]]]:
    source = path.read_text(encoding="utf-8")

    location_block = source[source.index("SEED_LOCATIONS"):]
    location_block = location_block[: location_block.index("\n];")]
    locations = [
        (match.group(1), float(match.group(2)), float(match.group(3)))
        for match in re.finditer(
            r"name:\s*'([^']*)'[^}]*?latitude:\s*(-?[\d.]+),\s*longitude:\s*(-?[\d.]+)",
            location_block,
        )
    ]

    road_block = source[source.index("SEED_ROADS: SeedRoad[]"):]
    road_block = road_block[: road_block.index("\n];")]
    roads: list[tuple[str, int, int]] = []
    for entry in re.finditer(r"\{([^{}]*)\}", road_block):
        body = entry.group(1)
        road_id = re.search(r"id:\s*'([^']+)'", body)
        from_index = re.search(r"fromIndex:\s*(\d+)", body)
        to_index = re.search(r"toIndex:\s*(\d+)", body)
        if road_id and from_index and to_index:
            roads.append((road_id.group(1), int(from_index.group(1)), int(to_index.group(1))))

    if not locations or not roads:
        raise SystemExit(f"could not parse locations/roads out of {path}")
    return locations, roads


def format_number(value: float) -> str:
    """Trim trailing zeros but keep ~1 cm precision."""
    text = f"{value:.7f}".rstrip("0").rstrip(".")
    return text or "0"


def round_half_up(value: float, digits: int) -> float:
    scale = 10**digits
    return math.floor(value * scale + 0.5) / scale


def fetch_route(
    origin: tuple[float, float],
    destination: tuple[float, float],
    cache_dir: Path,
    attempts: int = 4,
) -> dict:
    """Fetch one driving route, caching the raw JSON so reruns are idempotent."""
    coords = f"{origin[1]:.7f},{origin[0]:.7f};{destination[1]:.7f},{destination[0]:.7f}"
    query = urllib.parse.urlencode(
        {"overview": "full", "geometries": "geojson", "steps": "false", "alternatives": "false"}
    )
    url = f"{OSRM_URL}/{coords}?{query}"
    cache_file = cache_dir / (hashlib.sha1(url.encode()).hexdigest() + ".json")

    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))

    last_error = ""
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "nutriresq-geometry/1.0"})
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.load(response)
            if payload.get("code") != "Ok":
                raise RuntimeError(f"OSRM code {payload.get('code')}: {payload.get('message')}")
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(json.dumps(payload), encoding="utf-8")
            return payload
        except (urllib.error.URLError, TimeoutError, RuntimeError, json.JSONDecodeError) as error:
            last_error = str(error)
            time.sleep(2 ** attempt)
    raise SystemExit(f"OSRM request failed after {attempts} attempts: {last_error}\n{url}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=Path, default=DEFAULT_SEED)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--delay", type=float, default=1.1, help="seconds between live requests")
    args = parser.parse_args()

    if not args.seed.exists():
        raise SystemExit(f"missing {args.seed}")

    locations, roads = parse_seed(args.seed)
    print(f"seed: {len(locations)} locations, {len(roads)} roads")
    print(f"cache: {args.cache_dir}")

    entries: list[str] = []
    total_points = 0
    worst_snap = (0.0, "")
    ratios: list[float] = []

    for index, (road_id, from_index, to_index) in enumerate(roads, start=1):
        from_name, from_lat, from_lon = locations[from_index - 1]
        to_name, to_lat, to_lon = locations[to_index - 1]
        payload = fetch_route((from_lat, from_lon), (to_lat, to_lon), args.cache_dir)
        route = payload["routes"][0]
        waypoints = payload["waypoints"]

        for waypoint, name in ((waypoints[0], from_name), (waypoints[1], to_name)):
            if waypoint["distance"] > MAX_SNAP_M:
                raise SystemExit(
                    f"{name} snapped {waypoint['distance']:.0f} m from the road "
                    f"(limit {MAX_SNAP_M:.0f} m)"
                )
            if waypoint["distance"] > worst_snap[0]:
                worst_snap = (waypoint["distance"], name)

        # GeoJSON is [lon, lat]; the app stores [lat, lon]. The pin coordinates
        # are pinned to the ends so the drawn line reaches the marker.
        points = [(round(from_lat, 7), round(from_lon, 7))]
        points += [(round(lat, 7), round(lon, 7)) for lon, lat in route["geometry"]["coordinates"]]
        points.append((round(to_lat, 7), round(to_lon, 7)))

        deduped: list[tuple[float, float]] = [points[0]]
        for point in points[1:]:
            if point != deduped[-1]:
                deduped.append(point)

        distance_km = sum(
            great_circle_km(deduped[i - 1], deduped[i]) for i in range(1, len(deduped))
        )
        straight_km = great_circle_km((from_lat, from_lon), (to_lat, to_lon))
        ratios.append(distance_km / straight_km)
        total_points += len(deduped)

        packed = ",".join(f"[{format_number(a)},{format_number(b)}]" for a, b in deduped)
        entries.append(
            f"  '{road_id}': {{ distanceKm: {round_half_up(distance_km, 3):.3f}, "
            f"points: [{packed}] }},"
        )

        print(
            f"[{index:2d}/{len(roads)}] {from_name[:26]:<26} -> {to_name[:26]:<26} "
            f"{distance_km:6.2f} km  {len(deduped):3d} pts  x{distance_km / straight_km:4.2f}"
        )

        if not args.cache_dir.exists() or index < len(roads):
            time.sleep(args.delay)

    if len(entries) != len(roads):
        raise SystemExit(f"emitted {len(entries)} of {len(roads)} roads")

    ratios.sort()
    header = f"""/**
 * GENERATED FILE - do not edit by hand.
 *
 * Real Karachi driving geometry for every seeded road, baked once from the
 * public OSRM demo server (OpenStreetMap data). Each polyline starts and ends
 * on the stored landmark coordinate and follows the streets in between, so the
 * map draws routes along roads instead of straight chords between pins.
 *
 * Regenerate with: python backend/scripts/generate-road-geometry.py
 * {len(entries)} roads, {total_points} points, worst pin-to-road snap {worst_snap[0]:.0f} m.
 */

export interface SeedRoadGeometry {{
  /** Street distance along `points`, in km, including the pin-to-road legs. */
  distanceKm: number;
  /** `[lat, lon]` pairs from the from-location to the to-location. */
  points: [number, number][];
}}

export const SEED_ROAD_GEOMETRY: Record<string, SeedRoadGeometry> = {{
"""

    args.out.write_text(header + "\n".join(entries) + "\n};\n", encoding="utf-8")
    size_kb = args.out.stat().st_size / 1024
    print(f"wrote {args.out} ({size_kb:.0f} KB, {total_points} points)")
    print(
        f"routed/straight: min x{ratios[0]:.2f} median x{ratios[len(ratios) // 2]:.2f} "
        f"max x{ratios[-1]:.2f}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

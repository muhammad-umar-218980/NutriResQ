import { describe, expect, it } from 'vitest';

import { buildRoadGraph } from '../src/algorithms/lib/graph';
import {
  SEED_DP_STATE_COUNT,
  SEED_DONATIONS,
  SEED_DONORS,
  SEED_LOCATIONS,
  SEED_RECIPIENTS,
  SEED_ROADS,
  SEED_VEHICLES,
  roadCostKm,
  roadGeometry,
} from '../src/db/seed-data';
import { SEED_ROAD_GEOMETRY } from '../src/db/seed-road-geometry';
import { buildSeedSnapshot, seedLocationId, seedLocationName } from './helpers/seed-snapshot';

const snapshot = buildSeedSnapshot();

const EARTH_RADIUS_KM = 6371.0088;

/** Great-circle length of a stored polyline, in km. */
function polylineKm(points: [number, number][]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [lat1, lon1] = points[index - 1];
    const [lat2, lon2] = points[index];
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    total += 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return total;
}

function reachableFrom(graph: ReturnType<typeof buildRoadGraph>, startId: string): Set<string> {
  const seen = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const neighbor of graph.get(current)?.keys() ?? []) {
      const id = String(neighbor);
      if (!seen.has(id)) {
        seen.add(id);
        queue.push(id);
      }
    }
  }
  return seen;
}

describe('seed dataset: scale and shape', () => {
  it('meets the proposal minimum of 10 locations and 20 roads', () => {
    expect(SEED_LOCATIONS.length).toBeGreaterThanOrEqual(10);
    expect(SEED_ROADS.length).toBeGreaterThanOrEqual(20);
  });

  it('holds the expanded target counts', () => {
    expect(SEED_LOCATIONS).toHaveLength(28);
    expect(SEED_ROADS).toHaveLength(62);
    expect(SEED_DONORS).toHaveLength(15);
    expect(SEED_RECIPIENTS).toHaveLength(10);
    expect(SEED_VEHICLES).toHaveLength(5);
    expect(SEED_DONATIONS).toHaveLength(24);
  });

  it('keeps exactly three vehicles available so the exact DP stays under the default state limit', () => {
    const available = SEED_VEHICLES.filter((vehicle) => vehicle.isAvailable ?? true);
    expect(available).toHaveLength(3);
    expect(available.map((vehicle) => vehicle.capacityUnits)).toEqual([60, 45, 50]);

    const stateCount = available.reduce((product, vehicle) => product * (vehicle.capacityUnits + 1), 1);
    expect(stateCount).toBe(SEED_DP_STATE_COUNT);
    expect(stateCount).toBe(143_106);
    expect(stateCount).toBeLessThan(250_000);
  });

  it('has unique ids inside every collection', () => {
    const collections: Array<[string, Array<{ id: string }>]> = [
      ['locations', SEED_LOCATIONS],
      ['roads', SEED_ROADS],
      ['donors', SEED_DONORS],
      ['recipients', SEED_RECIPIENTS],
      ['donations', SEED_DONATIONS],
      ['vehicles', SEED_VEHICLES],
    ];

    for (const [label, entries] of collections) {
      const ids = new Set(entries.map((entry) => entry.id));
      expect(ids.size, `${label} contains a duplicate id`).toBe(entries.length);
    }
  });

  it('references only valid location, donor and recipient indexes', () => {
    for (const road of SEED_ROADS) {
      expect(road.fromIndex).toBeGreaterThanOrEqual(1);
      expect(road.fromIndex).toBeLessThanOrEqual(SEED_LOCATIONS.length);
      expect(road.toIndex).toBeGreaterThanOrEqual(1);
      expect(road.toIndex).toBeLessThanOrEqual(SEED_LOCATIONS.length);
      expect(road.fromIndex).not.toBe(road.toIndex);
    }

    for (const donor of SEED_DONORS) {
      expect(SEED_LOCATIONS[donor.locationIndex - 1]).toBeDefined();
    }
    for (const recipient of SEED_RECIPIENTS) {
      expect(SEED_LOCATIONS[recipient.locationIndex - 1]).toBeDefined();
    }
    for (const donation of SEED_DONATIONS) {
      expect(SEED_DONORS[donation.donorIndex - 1]).toBeDefined();
      if (donation.recipientIndex !== null) {
        expect(SEED_RECIPIENTS[donation.recipientIndex - 1]).toBeDefined();
      }
      expect(donation.weightUnits).toBeGreaterThan(0);
      expect(donation.valueScore).toBeGreaterThanOrEqual(0);
      expect(donation.valueScore).toBeLessThanOrEqual(100);
    }
    for (const vehicle of SEED_VEHICLES) {
      expect(SEED_LOCATIONS[vehicle.startLocationIndex - 1]).toBeDefined();
      expect(vehicle.capacityUnits).toBeGreaterThan(0);
    }
  });
});

describe('seed dataset: road costs', () => {
  it('prices every road with a finite positive cost', () => {
    for (const road of SEED_ROADS) {
      const cost = roadCostKm(road);
      expect(Number.isFinite(cost), `road ${road.id} has a non-finite cost`).toBe(true);
      expect(cost).toBeGreaterThan(0);
    }
  });

  it('keeps every cost at or above the projected straight-line distance (A* admissibility)', () => {
    const locationById = new Map(snapshot.locations.map((location) => [location.id, location]));
    let checked = 0;

    for (const road of snapshot.roads) {
      const from = locationById.get(road.fromLocationId);
      const to = locationById.get(road.toLocationId);
      expect(from, `road ${road.id} has an unknown from location`).toBeDefined();
      expect(to, `road ${road.id} has an unknown to location`).toBeDefined();

      const dx = (from as { projectedX: number }).projectedX - (to as { projectedX: number }).projectedX;
      const dy = (from as { projectedY: number }).projectedY - (to as { projectedY: number }).projectedY;
      const straightLineKm = Math.hypot(dx, dy) / 1000;

      expect(road.cost, `road ${road.id} cost ${road.cost} < straight line ${straightLineKm}`).toBeGreaterThanOrEqual(
        straightLineKm - 1e-9,
      );
      checked++;
    }

    expect(checked).toBe(SEED_ROADS.length);
  });

  it('rounds computed costs up to 0.1 km', () => {
    for (const road of SEED_ROADS) {
      if (typeof road.costKm === 'number') continue;
      const cost = roadCostKm(road);
      expect(Math.round(cost * 10)).toBeCloseTo(cost * 10, 6);
    }
  });
});

describe('seed dataset: baked street geometry', () => {
  it('has a polyline for every seeded road and nothing else', () => {
    expect(Object.keys(SEED_ROAD_GEOMETRY)).toHaveLength(SEED_ROADS.length);
    for (const road of SEED_ROADS) {
      expect(roadGeometry(road), `road ${road.id} has no baked geometry`).not.toBeNull();
    }
  });

  it('starts and ends each polyline on the road endpoints', () => {
    for (const road of SEED_ROADS) {
      const geometry = roadGeometry(road);
      if (!geometry) throw new Error(`road ${road.id} has no baked geometry`);

      const from = SEED_LOCATIONS[road.fromIndex - 1];
      const to = SEED_LOCATIONS[road.toIndex - 1];
      const first = geometry.points[0];
      const last = geometry.points[geometry.points.length - 1];

      expect(Math.abs(first[0] - from.latitude)).toBeLessThan(1e-5);
      expect(Math.abs(first[1] - from.longitude)).toBeLessThan(1e-5);
      expect(Math.abs(last[0] - to.latitude)).toBeLessThan(1e-5);
      expect(Math.abs(last[1] - to.longitude)).toBeLessThan(1e-5);
    }
  });

  it('prices each road at its polyline length rounded up to 0.1 km', () => {
    for (const road of SEED_ROADS) {
      if (typeof road.costKm === 'number') continue;
      const geometry = roadGeometry(road);
      if (!geometry) throw new Error(`road ${road.id} has no baked geometry`);

      expect(polylineKm(geometry.points), `road ${road.id} distance`).toBeCloseTo(
        geometry.distanceKm,
        2,
      );

      const cost = roadCostKm(road);
      expect(cost).toBeGreaterThanOrEqual(geometry.distanceKm - 1e-9);
      expect(cost - geometry.distanceKm).toBeLessThan(0.1 + 1e-9);
    }
  });

  it('follows streets rather than drawing a single chord', () => {
    const multiPoint = SEED_ROADS.filter((road) => (roadGeometry(road)?.points.length ?? 0) > 2);
    expect(multiPoint.length).toBe(SEED_ROADS.length);
  });
});

describe('seed dataset: connectivity and edge cases', () => {
  const graph = buildRoadGraph(snapshot.roads);

  it('has exactly one closed road', () => {
    const closed = SEED_ROADS.filter((road) => road.isAvailable === false);
    expect(closed).toHaveLength(1);
    expect(closed[0].id).toBe('20000000-0000-4000-8000-000000000022');
    expect(closed[0].label).toMatch(/closed/i);
  });

  it('leaves Nagan Chowrangi unreachable through available roads only', () => {
    const isolationId = seedLocationId(10);
    expect(seedLocationName(10)).toBe('Nagan Chowrangi');

    expect(graph.has(isolationId)).toBe(false);
    for (const [, edges] of graph) {
      expect(edges.has(isolationId)).toBe(false);
    }

    const reached = reachableFrom(graph, seedLocationId(1));
    expect(reached.has(isolationId)).toBe(false);
  });

  it('keeps every other location reachable from SITE Area depot', () => {
    const reached = reachableFrom(graph, seedLocationId(1));
    const isolationId = seedLocationId(10);

    for (const location of SEED_LOCATIONS) {
      if (location.id === isolationId) continue;
      expect(reached.has(location.id), `${location.name} is unreachable`).toBe(true);
    }
  });

  it('includes the designed eligibility edge cases', () => {
    const byName = new Map(SEED_DONATIONS.map((donation) => [donation.packageName, donation]));

    expect(byName.get('Dairy pack (expired)')?.status).toBe('expired');
    expect(byName.get('Ineligible sample')?.isEligible).toBe(false);
    expect(byName.get('Oversized pallet')?.weightUnits).toBeGreaterThan(60);
    expect(byName.get('Leafy greens')?.recipientIndex).toBeNull();
    expect(byName.get('Butter tubs')?.status).toBe('unavailable');
    expect(new Date(byName.get('Future harvest box')?.availableAt ?? 0).getTime()).toBeGreaterThan(
      new Date('2026-11-15T08:00:00.000Z').getTime(),
    );
  });
});

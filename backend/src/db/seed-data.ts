/**
 * Synthetic, clearly labelled seed dataset for scenario
 * 00000000-0000-4000-8000-000000000001.
 *
 * Units and scale (see remaining_plan.md and docs/ALGORITHMS.md):
 * - road cost is kilometres (`km`);
 * - `weight_units` is kilograms, 1 unit = 1 kg;
 * - `value_score` is 0..100 and the DP objective is value_score * recipient priority;
 * - expiry is evaluated against the run start: expires_at <= run_started_at is expired.
 *
 * The road network deliberately includes one closed road and one node that is
 * only reachable through it, so A* has a real unreachable pair to report.
 *
 * Every road cost must be >= the straight-line (projected) distance between its
 * endpoints, otherwise the A* heuristic stops being admissible. New roads leave
 * `costKm` undefined and are priced by `roadCostKm()` at 1.15x great-circle
 * distance, rounded up to 0.1 km. The handful of hand-written legacy costs were
 * audited against the same rule.
 */

export const SEED_SCENARIO_ID = '00000000-0000-4000-8000-000000000001';

export const SEED_SCENARIO = {
  id: SEED_SCENARIO_ID,
  name: 'Riverside District — Monday Rescue',
  description:
    'Twenty-eight locations, sixty-two roads (one closed), five vehicles (three available) and twenty-four donations including expired, ineligible, oversized, future-dated and unavailable cases.',
  status: 'ready',
} as const;

export interface SeedLocation {
  id: string;
  name: string;
  locationType: 'donor' | 'recipient' | 'hub' | 'other';
  latitude: number;
  longitude: number;
}

export const SEED_LOCATIONS: SeedLocation[] = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Central Depot', locationType: 'hub', latitude: 51.505, longitude: -0.09 },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Bridge Bakery', locationType: 'donor', latitude: 51.515, longitude: -0.1 },
  { id: '10000000-0000-4000-8000-000000000003', name: 'Green Grocer', locationType: 'donor', latitude: 51.512, longitude: -0.075 },
  { id: '10000000-0000-4000-8000-000000000004', name: 'Riverside Restaurant', locationType: 'donor', latitude: 51.498, longitude: -0.105 },
  { id: '10000000-0000-4000-8000-000000000005', name: 'Community Kitchen', locationType: 'recipient', latitude: 51.508, longitude: -0.068 },
  { id: '10000000-0000-4000-8000-000000000006', name: 'Hope Shelter', locationType: 'recipient', latitude: 51.518, longitude: -0.088 },
  { id: '10000000-0000-4000-8000-000000000007', name: 'Family Food Bank', locationType: 'recipient', latitude: 51.495, longitude: -0.08 },
  { id: '10000000-0000-4000-8000-000000000008', name: 'Northgate Hub', locationType: 'hub', latitude: 51.522, longitude: -0.078 },
  { id: '10000000-0000-4000-8000-000000000009', name: 'Westway Supermarket', locationType: 'donor', latitude: 51.502, longitude: -0.118 },
  { id: '10000000-0000-4000-8000-000000000010', name: 'Isolation Point', locationType: 'other', latitude: 51.53, longitude: -0.13 },
  { id: '10000000-0000-4000-8000-000000000011', name: 'Eastgate Wholesale', locationType: 'donor', latitude: 51.503, longitude: -0.055 },
  { id: '10000000-0000-4000-8000-000000000012', name: 'Harbour Fishmonger', locationType: 'donor', latitude: 51.492, longitude: -0.062 },
  { id: '10000000-0000-4000-8000-000000000013', name: 'Sunrise Dairy', locationType: 'donor', latitude: 51.487, longitude: -0.075 },
  { id: '10000000-0000-4000-8000-000000000014', name: 'Corner Bistro', locationType: 'donor', latitude: 51.511, longitude: -0.055 },
  { id: '10000000-0000-4000-8000-000000000015', name: 'Maple Street Market', locationType: 'donor', latitude: 51.5, longitude: -0.045 },
  { id: '10000000-0000-4000-8000-000000000016', name: 'Oakfield Care Home', locationType: 'recipient', latitude: 51.524, longitude: -0.062 },
  { id: '10000000-0000-4000-8000-000000000017', name: 'St. Mary Food Kitchen', locationType: 'recipient', latitude: 51.489, longitude: -0.093 },
  { id: '10000000-0000-4000-8000-000000000018', name: 'Riverside Youth Centre', locationType: 'recipient', latitude: 51.516, longitude: -0.112 },
  { id: '10000000-0000-4000-8000-000000000019', name: 'Hillside Pantry', locationType: 'recipient', latitude: 51.522, longitude: -0.1 },
  { id: '10000000-0000-4000-8000-000000000020', name: 'Unity Community Fridge', locationType: 'recipient', latitude: 51.494, longitude: -0.055 },
  { id: '10000000-0000-4000-8000-000000000021', name: 'Beacon Trust', locationType: 'recipient', latitude: 51.507, longitude: -0.032 },
  { id: '10000000-0000-4000-8000-000000000022', name: 'Bluebell Cafe', locationType: 'donor', latitude: 51.528, longitude: -0.07 },
  { id: '10000000-0000-4000-8000-000000000023', name: 'Metro Grocers', locationType: 'donor', latitude: 51.512, longitude: -0.13 },
  { id: '10000000-0000-4000-8000-000000000024', name: 'Park Lane Deli', locationType: 'donor', latitude: 51.494, longitude: -0.118 },
  { id: '10000000-0000-4000-8000-000000000025', name: 'Southbank Kitchen', locationType: 'recipient', latitude: 51.484, longitude: -0.08 },
  { id: '10000000-0000-4000-8000-000000000026', name: 'North End Dairy', locationType: 'donor', latitude: 51.532, longitude: -0.092 },
  { id: '10000000-0000-4000-8000-000000000027', name: 'Old Town Pantry', locationType: 'donor', latitude: 51.483, longitude: -0.1 },
  { id: '10000000-0000-4000-8000-000000000028', name: 'Riverside Wholesale', locationType: 'donor', latitude: 51.497, longitude: -0.035 },
];

export interface SeedRoad {
  id: string;
  fromIndex: number;
  toIndex: number;
  /** Explicit cost in km. Omit to let `roadCostKm()` price the road. */
  costKm?: number;
  isAvailable?: boolean;
  isBidirectional?: boolean;
  label?: string;
}

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in km between two seeded locations. */
function greatCircleKm(a: SeedLocation, b: SeedLocation): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Effective road cost in km. Hand-written costs are preserved; every other road
 * is priced at 1.15x great-circle distance rounded up to 0.1 km. The 15% factor
 * keeps the cost comfortably above the projected straight-line distance, so the
 * A* heuristic stays admissible.
 */
export function roadCostKm(road: SeedRoad): number {
  if (typeof road.costKm === 'number') return road.costKm;

  const from = SEED_LOCATIONS[road.fromIndex - 1];
  const to = SEED_LOCATIONS[road.toIndex - 1];
  if (!from || !to) {
    throw new Error(
      `Seed road ${road.id} refers to location indexes ${road.fromIndex}/${road.toIndex}, out of range.`,
    );
  }

  return Math.ceil(greatCircleKm(from, to) * 1.15 * 10) / 10;
}

/** one-based location indexes refer to SEED_LOCATIONS order. */
export const SEED_ROADS: SeedRoad[] = [
  // Legacy core network (explicit costs, audited against the straight-line rule).
  { id: '20000000-0000-4000-8000-000000000001', fromIndex: 1, toIndex: 2, costKm: 2.1 },
  { id: '20000000-0000-4000-8000-000000000002', fromIndex: 1, toIndex: 3, costKm: 1.4 },
  { id: '20000000-0000-4000-8000-000000000003', fromIndex: 1, toIndex: 4, costKm: 1.9 },
  { id: '20000000-0000-4000-8000-000000000004', fromIndex: 2, toIndex: 3, costKm: 2.8 },
  { id: '20000000-0000-4000-8000-000000000005', fromIndex: 2, toIndex: 6, costKm: 1.6 },
  { id: '20000000-0000-4000-8000-000000000006', fromIndex: 3, toIndex: 5, costKm: 1.1 },
  { id: '20000000-0000-4000-8000-000000000007', fromIndex: 4, toIndex: 5, costKm: 3.0, label: 'Riverside detour (re-priced to stay above straight-line distance)' },
  { id: '20000000-0000-4000-8000-000000000008', fromIndex: 4, toIndex: 7, costKm: 2.2 },
  { id: '20000000-0000-4000-8000-000000000009', fromIndex: 5, toIndex: 6, costKm: 2.0 },
  { id: '20000000-0000-4000-8000-000000000010', fromIndex: 5, toIndex: 7, costKm: 2.3 },
  { id: '20000000-0000-4000-8000-000000000011', fromIndex: 6, toIndex: 8, costKm: 1.3 },
  { id: '20000000-0000-4000-8000-000000000012', fromIndex: 3, toIndex: 6, costKm: 2.6 },
  { id: '20000000-0000-4000-8000-000000000013', fromIndex: 7, toIndex: 9, costKm: 3.4 },
  { id: '20000000-0000-4000-8000-000000000014', fromIndex: 4, toIndex: 9, costKm: 2.9 },
  { id: '20000000-0000-4000-8000-000000000015', fromIndex: 1, toIndex: 9, costKm: 2.7 },
  { id: '20000000-0000-4000-8000-000000000016', fromIndex: 5, toIndex: 8, costKm: 2.4 },
  { id: '20000000-0000-4000-8000-000000000017', fromIndex: 2, toIndex: 8, costKm: 3.1 },
  { id: '20000000-0000-4000-8000-000000000018', fromIndex: 3, toIndex: 8, costKm: 2.5 },
  { id: '20000000-0000-4000-8000-000000000019', fromIndex: 1, toIndex: 5, costKm: 2.2 },
  { id: '20000000-0000-4000-8000-000000000020', fromIndex: 6, toIndex: 7, costKm: 2.9 },
  { id: '20000000-0000-4000-8000-000000000021', fromIndex: 8, toIndex: 7, costKm: 3.3 },
  {
    id: '20000000-0000-4000-8000-000000000022',
    fromIndex: 1,
    toIndex: 10,
    costKm: 6.5,
    isAvailable: false,
    label: 'North bridge closed for repairs',
  },

  // Expansion network (computed 1.15x great-circle cost).
  { id: '20000000-0000-4000-8000-000000000023', fromIndex: 5, toIndex: 11 },
  { id: '20000000-0000-4000-8000-000000000024', fromIndex: 3, toIndex: 11 },
  { id: '20000000-0000-4000-8000-000000000025', fromIndex: 11, toIndex: 15 },
  { id: '20000000-0000-4000-8000-000000000026', fromIndex: 7, toIndex: 12 },
  { id: '20000000-0000-4000-8000-000000000027', fromIndex: 12, toIndex: 20 },
  { id: '20000000-0000-4000-8000-000000000028', fromIndex: 12, toIndex: 13 },
  { id: '20000000-0000-4000-8000-000000000029', fromIndex: 13, toIndex: 25 },
  { id: '20000000-0000-4000-8000-000000000030', fromIndex: 13, toIndex: 27 },
  { id: '20000000-0000-4000-8000-000000000031', fromIndex: 5, toIndex: 14 },
  { id: '20000000-0000-4000-8000-000000000032', fromIndex: 14, toIndex: 15 },
  { id: '20000000-0000-4000-8000-000000000033', fromIndex: 11, toIndex: 14 },
  { id: '20000000-0000-4000-8000-000000000034', fromIndex: 15, toIndex: 21 },
  { id: '20000000-0000-4000-8000-000000000035', fromIndex: 8, toIndex: 16 },
  { id: '20000000-0000-4000-8000-000000000036', fromIndex: 6, toIndex: 16 },
  { id: '20000000-0000-4000-8000-000000000037', fromIndex: 16, toIndex: 22 },
  { id: '20000000-0000-4000-8000-000000000038', fromIndex: 13, toIndex: 17 },
  { id: '20000000-0000-4000-8000-000000000039', fromIndex: 25, toIndex: 17 },
  { id: '20000000-0000-4000-8000-000000000040', fromIndex: 7, toIndex: 17 },
  { id: '20000000-0000-4000-8000-000000000041', fromIndex: 2, toIndex: 18 },
  { id: '20000000-0000-4000-8000-000000000042', fromIndex: 9, toIndex: 18 },
  { id: '20000000-0000-4000-8000-000000000043', fromIndex: 18, toIndex: 19 },
  { id: '20000000-0000-4000-8000-000000000044', fromIndex: 6, toIndex: 19 },
  { id: '20000000-0000-4000-8000-000000000045', fromIndex: 19, toIndex: 23 },
  { id: '20000000-0000-4000-8000-000000000046', fromIndex: 7, toIndex: 20 },
  { id: '20000000-0000-4000-8000-000000000047', fromIndex: 5, toIndex: 21 },
  { id: '20000000-0000-4000-8000-000000000048', fromIndex: 8, toIndex: 22 },
  { id: '20000000-0000-4000-8000-000000000049', fromIndex: 22, toIndex: 26 },
  { id: '20000000-0000-4000-8000-000000000050', fromIndex: 18, toIndex: 23 },
  { id: '20000000-0000-4000-8000-000000000051', fromIndex: 9, toIndex: 23 },
  { id: '20000000-0000-4000-8000-000000000052', fromIndex: 23, toIndex: 24 },
  { id: '20000000-0000-4000-8000-000000000053', fromIndex: 9, toIndex: 24 },
  { id: '20000000-0000-4000-8000-000000000054', fromIndex: 4, toIndex: 24 },
  { id: '20000000-0000-4000-8000-000000000055', fromIndex: 17, toIndex: 27 },
  { id: '20000000-0000-4000-8000-000000000056', fromIndex: 19, toIndex: 26 },
  { id: '20000000-0000-4000-8000-000000000057', fromIndex: 8, toIndex: 26 },
  { id: '20000000-0000-4000-8000-000000000058', fromIndex: 25, toIndex: 27 },
  { id: '20000000-0000-4000-8000-000000000059', fromIndex: 24, toIndex: 27 },
  { id: '20000000-0000-4000-8000-000000000060', fromIndex: 15, toIndex: 28 },
  { id: '20000000-0000-4000-8000-000000000061', fromIndex: 21, toIndex: 28 },
  { id: '20000000-0000-4000-8000-000000000062', fromIndex: 20, toIndex: 28 },
];

export interface SeedDemoUser {
  id: string;
  email: string;
  phone: string;
  role: 'donor' | 'recipient' | 'delivery';
  profile:
    | { businessName: string; businessType: string; representativeName: string }
    | { organizationName: string; organizationType: string; representativeName: string }
    | { companyName: string; businessType: string; fleetManagerName: string };
}

export const SEED_DEMO_USERS: SeedDemoUser[] = [
  {
    id: '70000000-0000-4000-8000-000000000001',
    email: 'donor@nutriresq.local',
    phone: '+44 7700 900000',
    role: 'donor',
    profile: { businessName: 'Bridge Bakery', businessType: 'Bakery', representativeName: 'Ada Baker' },
  },
  {
    id: '70000000-0000-4000-8000-000000000002',
    email: 'recipient@nutriresq.local',
    phone: '+44 7700 900001',
    role: 'recipient',
    profile: {
      organizationName: 'Community Kitchen',
      organizationType: 'Community Kitchen',
      representativeName: 'Maya Okafor',
    },
  },
  {
    id: '70000000-0000-4000-8000-000000000003',
    email: 'delivery@nutriresq.local',
    phone: '+44 7700 900002',
    role: 'delivery',
    profile: {
      companyName: 'Green Mile Logistics',
      businessType: 'Logistics Provider',
      fleetManagerName: 'Sam Rivera',
    },
  },
];

export interface SeedDonor {
  id: string;
  locationIndex: number;
  name: string;
  donorType: string;
  demoUser?: 'donor';
}

export const SEED_DONORS: SeedDonor[] = [
  { id: '30000000-0000-4000-8000-000000000001', locationIndex: 2, name: 'Bridge Bakery', donorType: 'bakery', demoUser: 'donor' },
  { id: '30000000-0000-4000-8000-000000000002', locationIndex: 3, name: 'Green Grocer', donorType: 'supermarket' },
  { id: '30000000-0000-4000-8000-000000000003', locationIndex: 4, name: 'Riverside Restaurant', donorType: 'restaurant' },
  { id: '30000000-0000-4000-8000-000000000004', locationIndex: 9, name: 'Westway Supermarket', donorType: 'supermarket' },
  { id: '30000000-0000-4000-8000-000000000005', locationIndex: 11, name: 'Eastgate Wholesale', donorType: 'wholesaler' },
  { id: '30000000-0000-4000-8000-000000000006', locationIndex: 12, name: 'Harbour Fishmonger', donorType: 'restaurant' },
  { id: '30000000-0000-4000-8000-000000000007', locationIndex: 13, name: 'Sunrise Dairy', donorType: 'dairy' },
  { id: '30000000-0000-4000-8000-000000000008', locationIndex: 14, name: 'Corner Bistro', donorType: 'restaurant' },
  { id: '30000000-0000-4000-8000-000000000009', locationIndex: 15, name: 'Maple Street Market', donorType: 'market' },
  { id: '30000000-0000-4000-8000-000000000010', locationIndex: 22, name: 'Bluebell Cafe', donorType: 'cafe' },
  { id: '30000000-0000-4000-8000-000000000011', locationIndex: 23, name: 'Metro Grocers', donorType: 'supermarket' },
  { id: '30000000-0000-4000-8000-000000000012', locationIndex: 24, name: 'Park Lane Deli', donorType: 'deli' },
  { id: '30000000-0000-4000-8000-000000000013', locationIndex: 26, name: 'North End Dairy', donorType: 'dairy' },
  { id: '30000000-0000-4000-8000-000000000014', locationIndex: 27, name: 'Old Town Pantry', donorType: 'grocery' },
  { id: '30000000-0000-4000-8000-000000000015', locationIndex: 28, name: 'Riverside Wholesale', donorType: 'wholesaler' },
];

export interface SeedRecipient {
  id: string;
  locationIndex: number;
  name: string;
  recipientType: string;
  demandUnits: number;
  priorityScore: number;
  demoUser?: 'recipient';
}

export const SEED_RECIPIENTS: SeedRecipient[] = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    locationIndex: 5,
    name: 'Community Kitchen',
    recipientType: 'community_kitchen',
    demandUnits: 40,
    priorityScore: 90,
    demoUser: 'recipient',
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    locationIndex: 6,
    name: 'Hope Shelter',
    recipientType: 'shelter',
    demandUnits: 30,
    priorityScore: 70,
  },
  {
    id: '40000000-0000-4000-8000-000000000003',
    locationIndex: 7,
    name: 'Family Food Bank',
    recipientType: 'food_bank',
    demandUnits: 50,
    priorityScore: 60,
  },
  {
    id: '40000000-0000-4000-8000-000000000004',
    locationIndex: 16,
    name: 'Oakfield Care Home',
    recipientType: 'care_home',
    demandUnits: 35,
    priorityScore: 85,
  },
  {
    id: '40000000-0000-4000-8000-000000000005',
    locationIndex: 17,
    name: 'St. Mary Food Kitchen',
    recipientType: 'community_kitchen',
    demandUnits: 45,
    priorityScore: 80,
  },
  {
    id: '40000000-0000-4000-8000-000000000006',
    locationIndex: 18,
    name: 'Riverside Youth Centre',
    recipientType: 'youth_centre',
    demandUnits: 25,
    priorityScore: 55,
  },
  {
    id: '40000000-0000-4000-8000-000000000007',
    locationIndex: 19,
    name: 'Hillside Pantry',
    recipientType: 'food_bank',
    demandUnits: 30,
    priorityScore: 65,
  },
  {
    id: '40000000-0000-4000-8000-000000000008',
    locationIndex: 20,
    name: 'Unity Community Fridge',
    recipientType: 'community_fridge',
    demandUnits: 20,
    priorityScore: 50,
  },
  {
    id: '40000000-0000-4000-8000-000000000009',
    locationIndex: 21,
    name: 'Beacon Trust',
    recipientType: 'charity',
    demandUnits: 40,
    priorityScore: 75,
  },
  {
    id: '40000000-0000-4000-8000-000000000010',
    locationIndex: 25,
    name: 'Southbank Kitchen',
    recipientType: 'community_kitchen',
    demandUnits: 35,
    priorityScore: 95,
  },
];

export interface SeedDonation {
  id: string;
  donorIndex: number;
  packageName: string;
  weightUnits: number;
  valueScore: number;
  recipientIndex: number | null;
  availableAt: string | null;
  expiresAt: string | null;
  isEligible: boolean;
  status: 'available' | 'expired' | 'reserved' | 'unavailable';
  note?: string;
}

const AVAILABLE_AT = '2026-11-10T06:00:00.000Z';
const EXPIRED_AT = '2026-01-01T00:00:00.000Z';
const FUTURE_AT = '2030-01-01T06:00:00.000Z';

export const SEED_DONATIONS: SeedDonation[] = [
  { id: '50000000-0000-4000-8000-000000000001', donorIndex: 1, packageName: 'Bread crate', weightUnits: 15, valueScore: 60, recipientIndex: 1, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000002', donorIndex: 1, packageName: 'Pastry tray', weightUnits: 12, valueScore: 45, recipientIndex: 1, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000003', donorIndex: 2, packageName: 'Mixed produce box', weightUnits: 25, valueScore: 70, recipientIndex: 3, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000004', donorIndex: 2, packageName: 'Leafy greens', weightUnits: 8, valueScore: 30, recipientIndex: null, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available', note: 'No intended recipient; priority falls back to 1.' },
  { id: '50000000-0000-4000-8000-000000000005', donorIndex: 3, packageName: 'Cooked meals', weightUnits: 30, valueScore: 95, recipientIndex: 2, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000006', donorIndex: 3, packageName: 'Dairy pack (expired)', weightUnits: 10, valueScore: 40, recipientIndex: 1, availableAt: AVAILABLE_AT, expiresAt: EXPIRED_AT, isEligible: true, status: 'expired', note: 'Expired case: expires_at in the past.' },
  { id: '50000000-0000-4000-8000-000000000007', donorIndex: 4, packageName: 'Canned goods', weightUnits: 20, valueScore: 55, recipientIndex: 3, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000008', donorIndex: 4, packageName: 'Fresh fruit', weightUnits: 18, valueScore: 50, recipientIndex: 2, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000009', donorIndex: 1, packageName: 'Oversized pallet', weightUnits: 80, valueScore: 80, recipientIndex: 3, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available', note: 'Oversized case: heavier than every vehicle capacity.' },
  { id: '50000000-0000-4000-8000-000000000010', donorIndex: 2, packageName: 'Ineligible sample', weightUnits: 5, valueScore: 10, recipientIndex: 1, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: false, status: 'available', note: 'Ineligible case: is_eligible = false.' },
  { id: '50000000-0000-4000-8000-000000000011', donorIndex: 3, packageName: 'Surplus stew', weightUnits: 30, valueScore: 65, recipientIndex: 1, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000012', donorIndex: 5, packageName: 'Bulk rice sacks', weightUnits: 40, valueScore: 75, recipientIndex: 4, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000013', donorIndex: 5, packageName: 'Pasta cartons', weightUnits: 18, valueScore: 55, recipientIndex: 9, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000014', donorIndex: 6, packageName: 'Fresh fish crates', weightUnits: 22, valueScore: 80, recipientIndex: 5, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000015', donorIndex: 7, packageName: 'Milk churns', weightUnits: 24, valueScore: 50, recipientIndex: 4, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000016', donorIndex: 7, packageName: 'Yoghurt pallet', weightUnits: 35, valueScore: 60, recipientIndex: 8, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000017', donorIndex: 8, packageName: 'Prepared salads', weightUnits: 14, valueScore: 65, recipientIndex: 6, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000018', donorIndex: 9, packageName: 'Bread surplus', weightUnits: 20, valueScore: 45, recipientIndex: 7, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000019', donorIndex: 10, packageName: 'Cake boxes', weightUnits: 12, valueScore: 40, recipientIndex: 10, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000020', donorIndex: 11, packageName: 'Canned soup', weightUnits: 28, valueScore: 70, recipientIndex: 5, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000021', donorIndex: 12, packageName: 'Cheese wheels', weightUnits: 16, valueScore: 60, recipientIndex: 9, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000022', donorIndex: 13, packageName: 'Butter tubs', weightUnits: 9, valueScore: 35, recipientIndex: 8, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'unavailable', note: 'Unavailable case: status is "unavailable".' },
  { id: '50000000-0000-4000-8000-000000000023', donorIndex: 14, packageName: 'Frozen peas', weightUnits: 15, valueScore: 50, recipientIndex: 6, availableAt: AVAILABLE_AT, expiresAt: null, isEligible: true, status: 'available' },
  { id: '50000000-0000-4000-8000-000000000024', donorIndex: 15, packageName: 'Future harvest box', weightUnits: 20, valueScore: 65, recipientIndex: 3, availableAt: FUTURE_AT, expiresAt: null, isEligible: true, status: 'available', note: 'Future-dated case: available_at is after the run start.' },
];

export interface SeedVehicle {
  id: string;
  name: string;
  capacityUnits: number;
  startLocationIndex: number;
  /** Defaults to true. Unavailable vehicles stay in the scenario for the simulator. */
  isAvailable?: boolean;
  demoUser?: 'delivery';
}

export const SEED_VEHICLES: SeedVehicle[] = [
  { id: '60000000-0000-4000-8000-000000000001', name: 'Van A — 60', capacityUnits: 60, startLocationIndex: 1, demoUser: 'delivery' },
  { id: '60000000-0000-4000-8000-000000000002', name: 'Van B — 45', capacityUnits: 45, startLocationIndex: 1, demoUser: 'delivery' },
  { id: '60000000-0000-4000-8000-000000000003', name: 'Van C — 50', capacityUnits: 50, startLocationIndex: 1, demoUser: 'delivery' },
  { id: '60000000-0000-4000-8000-000000000004', name: 'Refrigerated Truck — 70', capacityUnits: 70, startLocationIndex: 8, isAvailable: false, demoUser: 'delivery' },
  { id: '60000000-0000-4000-8000-000000000005', name: 'Cargo Bike — 15', capacityUnits: 15, startLocationIndex: 5, isAvailable: false, demoUser: 'delivery' },
];

/**
 * Expected DP state space for the three available vehicles (60 + 45 + 50 kg):
 * (60+1) * (45+1) * (50+1) = 143,106 states, below the 250,000 default limit.
 */
export const SEED_DP_STATE_COUNT = (60 + 1) * (45 + 1) * (50 + 1);

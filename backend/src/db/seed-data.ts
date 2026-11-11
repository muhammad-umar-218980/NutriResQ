/**
 * Synthetic, clearly labelled seed dataset for scenario
 * 00000000-0000-4000-8000-000000000001.
 *
 * Units and scale (recorded in docs/IMPLEMENTATION_PLAN.md):
 * - road cost is kilometres (`km`);
 * - `weight_units` is kilograms, 1 unit = 1 kg;
 * - `value_score` is 0..100 and the DP objective is value_score * recipient priority;
 * - expiry is evaluated against the run start: expires_at <= run_started_at is expired.
 *
 * The road network deliberately includes one closed road and one node that is
 * only reachable through it, so A* has a real unreachable pair to report.
 */

export const SEED_SCENARIO_ID = '00000000-0000-4000-8000-000000000001';

export const SEED_SCENARIO = {
  id: SEED_SCENARIO_ID,
  name: 'Riverside District — Monday Rescue',
  description:
    'Ten locations, twenty-two roads (one closed), three vehicles and eleven donations including expired, ineligible and oversized cases.',
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
];

export interface SeedRoad {
  id: string;
  fromIndex: number;
  toIndex: number;
  costKm: number;
  isAvailable?: boolean;
  isBidirectional?: boolean;
  label?: string;
}

/** one-based location indexes refer to SEED_LOCATIONS order. */
export const SEED_ROADS: SeedRoad[] = [
  { id: '20000000-0000-4000-8000-000000000001', fromIndex: 1, toIndex: 2, costKm: 2.1 },
  { id: '20000000-0000-4000-8000-000000000002', fromIndex: 1, toIndex: 3, costKm: 1.4 },
  { id: '20000000-0000-4000-8000-000000000003', fromIndex: 1, toIndex: 4, costKm: 1.9 },
  { id: '20000000-0000-4000-8000-000000000004', fromIndex: 2, toIndex: 3, costKm: 2.8 },
  { id: '20000000-0000-4000-8000-000000000005', fromIndex: 2, toIndex: 6, costKm: 1.6 },
  { id: '20000000-0000-4000-8000-000000000006', fromIndex: 3, toIndex: 5, costKm: 1.1 },
  { id: '20000000-0000-4000-8000-000000000007', fromIndex: 4, toIndex: 5, costKm: 1.7 },
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
];

export interface SeedVehicle {
  id: string;
  name: string;
  capacityUnits: number;
  startLocationIndex: number;
  demoUser?: 'delivery';
}

export const SEED_VEHICLES: SeedVehicle[] = [
  { id: '60000000-0000-4000-8000-000000000001', name: 'Van A — 60', capacityUnits: 60, startLocationIndex: 1, demoUser: 'delivery' },
  { id: '60000000-0000-4000-8000-000000000002', name: 'Van B — 45', capacityUnits: 45, startLocationIndex: 1, demoUser: 'delivery' },
  { id: '60000000-0000-4000-8000-000000000003', name: 'Van C — 50', capacityUnits: 50, startLocationIndex: 1, demoUser: 'delivery' },
];

import type { PoolClient } from 'pg';
import { env } from '../config/env';
import { hashPassword } from '../lib/password';
import { pool, withTransaction } from './pool';
import {
  SEED_DEMO_USERS,
  SEED_DONATIONS,
  SEED_DONORS,
  SEED_LOCATIONS,
  SEED_RECIPIENTS,
  SEED_ROADS,
  SEED_SCENARIO,
  SEED_VEHICLES,
  type SeedDemoUser,
} from './seed-data';

/**
 * Seeds the single administrator account from the environment. Running this
 * again resets that account's password to ADMIN_PASSWORD, which is the
 * documented way to recover admin access.
 */
async function seedAdmin(client: PoolClient): Promise<string> {
  const email = env.ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);

  const existing = await client.query<{ id: string }>(
    'SELECT id FROM users WHERE lower(email) = lower($1)',
    [email],
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE users
          SET password_hash = $2,
              role = 'admin',
              status = 'active',
              email_verified_at = COALESCE(email_verified_at, now()),
              updated_at = now()
        WHERE id = $1`,
      [existing.rows[0].id, passwordHash],
    );
    return `admin updated: ${email}`;
  }

  await client.query(
    `INSERT INTO users (email, phone, password_hash, role, status, email_verified_at)
     VALUES ($1, NULL, $2, 'admin', 'active', now())`,
    [email, passwordHash],
  );

  return `admin created: ${email}`;
}

function locationId(index: number): string {
  const location = SEED_LOCATIONS[index - 1];
  if (!location) throw new Error(`Seed location index ${index} is out of range.`);
  return location.id;
}

async function seedDemoAccount(
  client: PoolClient,
  demo: SeedDemoUser,
  passwordHash: string,
): Promise<void> {
  await client.query(
    `INSERT INTO users (id, email, phone, password_hash, role, status, email_verified_at)
     VALUES ($1, $2, $3, $4, $5, 'active', now())
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           status = 'active',
           email_verified_at = COALESCE(users.email_verified_at, now()),
           updated_at = now()`,
    [demo.id, demo.email, demo.phone, passwordHash, demo.role],
  );

  if (demo.role === 'donor') {
    const profile = demo.profile as { businessName: string; businessType: string; representativeName: string };
    await client.query(
      `INSERT INTO donor_profiles (user_id, business_name, business_type, representative_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET business_name = EXCLUDED.business_name,
             business_type = EXCLUDED.business_type,
             representative_name = EXCLUDED.representative_name,
             updated_at = now()`,
      [demo.id, profile.businessName, profile.businessType, profile.representativeName],
    );
  } else if (demo.role === 'recipient') {
    const profile = demo.profile as { organizationName: string; organizationType: string; representativeName: string };
    await client.query(
      `INSERT INTO recipient_profiles (user_id, organization_name, organization_type, representative_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET organization_name = EXCLUDED.organization_name,
             organization_type = EXCLUDED.organization_type,
             representative_name = EXCLUDED.representative_name,
             updated_at = now()`,
      [demo.id, profile.organizationName, profile.organizationType, profile.representativeName],
    );
  } else {
    const profile = demo.profile as { companyName: string; businessType: string; fleetManagerName: string };
    await client.query(
      `INSERT INTO delivery_profiles (user_id, company_name, business_type, fleet_manager_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET company_name = EXCLUDED.company_name,
             business_type = EXCLUDED.business_type,
             fleet_manager_name = EXCLUDED.fleet_manager_name,
             updated_at = now()`,
      [demo.id, profile.companyName, profile.businessType, profile.fleetManagerName],
    );
  }
}

async function seedScenarioData(client: PoolClient): Promise<void> {
  await client.query(
    `INSERT INTO scenarios (id, name, description, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           description = EXCLUDED.description,
           status = EXCLUDED.status,
           updated_at = now()`,
    [SEED_SCENARIO.id, SEED_SCENARIO.name, SEED_SCENARIO.description, SEED_SCENARIO.status],
  );

  for (const location of SEED_LOCATIONS) {
    await client.query(
      `INSERT INTO locations (id, name, location_type, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             location_type = EXCLUDED.location_type,
             latitude = EXCLUDED.latitude,
             longitude = EXCLUDED.longitude,
             updated_at = now()`,
      [location.id, location.name, location.locationType, location.latitude, location.longitude],
    );

    await client.query(
      `INSERT INTO scenario_locations (scenario_id, location_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [SEED_SCENARIO.id, location.id],
    );
  }

  for (const road of SEED_ROADS) {
    await client.query(
      `INSERT INTO roads
         (id, scenario_id, from_location_id, to_location_id, cost, cost_unit, is_available, is_bidirectional, label)
       VALUES ($1, $2, $3, $4, $5, 'km', $6, $7, $8)
       ON CONFLICT (id) DO UPDATE
         SET from_location_id = EXCLUDED.from_location_id,
             to_location_id = EXCLUDED.to_location_id,
             cost = EXCLUDED.cost,
             is_available = EXCLUDED.is_available,
             is_bidirectional = EXCLUDED.is_bidirectional,
             label = EXCLUDED.label,
             updated_at = now()`,
      [
        road.id,
        SEED_SCENARIO.id,
        locationId(road.fromIndex),
        locationId(road.toIndex),
        road.costKm,
        road.isAvailable ?? true,
        road.isBidirectional ?? true,
        road.label ?? null,
      ],
    );
  }

  const donorDemoUser = SEED_DEMO_USERS.find((user) => user.role === 'donor');
  for (const donor of SEED_DONORS) {
    await client.query(
      `INSERT INTO donors (id, scenario_id, location_id, user_id, name, donor_type, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (id) DO UPDATE
         SET location_id = EXCLUDED.location_id,
             user_id = EXCLUDED.user_id,
             name = EXCLUDED.name,
             donor_type = EXCLUDED.donor_type,
             updated_at = now()`,
      [
        donor.id,
        SEED_SCENARIO.id,
        locationId(donor.locationIndex),
        donor.demoUser ? (donorDemoUser?.id ?? null) : null,
        donor.name,
        donor.donorType,
      ],
    );
  }

  const recipientDemoUser = SEED_DEMO_USERS.find((user) => user.role === 'recipient');
  for (const recipient of SEED_RECIPIENTS) {
    await client.query(
      `INSERT INTO recipients
         (id, scenario_id, location_id, user_id, name, recipient_type, demand_units, priority_score, is_available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       ON CONFLICT (id) DO UPDATE
         SET location_id = EXCLUDED.location_id,
             user_id = EXCLUDED.user_id,
             name = EXCLUDED.name,
             recipient_type = EXCLUDED.recipient_type,
             demand_units = EXCLUDED.demand_units,
             priority_score = EXCLUDED.priority_score,
             updated_at = now()`,
      [
        recipient.id,
        SEED_SCENARIO.id,
        locationId(recipient.locationIndex),
        recipient.demoUser ? (recipientDemoUser?.id ?? null) : null,
        recipient.name,
        recipient.recipientType,
        recipient.demandUnits,
        recipient.priorityScore,
      ],
    );
  }

  for (const donation of SEED_DONATIONS) {
    const donor = SEED_DONORS[donation.donorIndex - 1];
    const recipient = donation.recipientIndex ? SEED_RECIPIENTS[donation.recipientIndex - 1] : null;
    await client.query(
      `INSERT INTO donations
         (id, scenario_id, donor_id, package_name, weight_units, value_score, recipient_id,
          available_at, expires_at, is_eligible, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE
         SET donor_id = EXCLUDED.donor_id,
             package_name = EXCLUDED.package_name,
             weight_units = EXCLUDED.weight_units,
             value_score = EXCLUDED.value_score,
             recipient_id = EXCLUDED.recipient_id,
             available_at = EXCLUDED.available_at,
             expires_at = EXCLUDED.expires_at,
             is_eligible = EXCLUDED.is_eligible,
             status = EXCLUDED.status,
             updated_at = now()`,
      [
        donation.id,
        SEED_SCENARIO.id,
        donor.id,
        donation.packageName,
        donation.weightUnits,
        donation.valueScore,
        recipient?.id ?? null,
        donation.availableAt,
        donation.expiresAt,
        donation.isEligible,
        donation.status,
      ],
    );
  }

  const deliveryDemoUser = SEED_DEMO_USERS.find((user) => user.role === 'delivery');
  for (const vehicle of SEED_VEHICLES) {
    await client.query(
      `INSERT INTO vehicles
         (id, scenario_id, owner_user_id, name, capacity_units, start_location_id, is_available)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (id) DO UPDATE
         SET owner_user_id = EXCLUDED.owner_user_id,
             name = EXCLUDED.name,
             capacity_units = EXCLUDED.capacity_units,
             start_location_id = EXCLUDED.start_location_id,
             updated_at = now()`,
      [
        vehicle.id,
        SEED_SCENARIO.id,
        vehicle.demoUser ? (deliveryDemoUser?.id ?? null) : null,
        vehicle.name,
        vehicle.capacityUnits,
        locationId(vehicle.startLocationIndex),
      ],
    );
  }
}

export async function seedDatabase(): Promise<string[]> {
  const lines: string[] = [];

  const demoPasswordHash = await hashPassword(env.DEMO_PASSWORD);

  await withTransaction(async (client) => {
    lines.push(await seedAdmin(client));
    for (const demo of SEED_DEMO_USERS) {
      await seedDemoAccount(client, demo, demoPasswordHash);
    }
    lines.push(
      `demo accounts ready: ${SEED_DEMO_USERS.map((user) => user.email).join(', ')}`,
    );

    await seedScenarioData(client);
    lines.push(
      `scenario seeded: ${SEED_SCENARIO.name} (${SEED_LOCATIONS.length} locations, ${SEED_ROADS.length} roads, ` +
        `${SEED_DONORS.length} donors, ${SEED_RECIPIENTS.length} recipients, ${SEED_DONATIONS.length} donations, ` +
        `${SEED_VEHICLES.length} vehicles)`,
    );
  });

  return lines;
}

async function main(): Promise<void> {
  const lines = await seedDatabase();
  for (const line of lines) console.log(`  · ${line}`);
  console.log('Seed complete.');
  await pool.end();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

import type { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { AccountStatus, Role } from '../types/auth';

export interface UserRecord {
  id: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  role: Role;
  status: AccountStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithProfile extends Omit<UserRecord, 'passwordHash'> {
  profile: Record<string, string | null> | null;
}

interface UserDbRow {
  id: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: Role;
  status: AccountStatus;
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface ProfileDbRow extends UserDbRow {
  business_name: string | null;
  donor_business_type: string | null;
  donor_representative: string | null;
  organization_name: string | null;
  organization_type: string | null;
  recipient_representative: string | null;
  company_name: string | null;
  delivery_business_type: string | null;
  fleet_manager_name: string | null;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toUser(row: UserDbRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    role: row.role,
    status: row.status,
    emailVerifiedAt: row.email_verified_at ? toIso(row.email_verified_at) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/** Strips the credential column before a user leaves the repository. */
function toSafeUser(row: UserDbRow): Omit<UserRecord, 'passwordHash'> {
  const { passwordHash: _passwordHash, ...safe } = toUser(row);
  return safe;
}

function profileFor(row: ProfileDbRow): Record<string, string | null> | null {
  switch (row.role) {
    case 'donor':
      if (!row.business_name) return null;
      return {
        businessName: row.business_name,
        businessType: row.donor_business_type,
        representativeName: row.donor_representative,
      };
    case 'recipient':
      if (!row.organization_name) return null;
      return {
        organizationName: row.organization_name,
        organizationType: row.organization_type,
        representativeName: row.recipient_representative,
      };
    case 'delivery':
      if (!row.company_name) return null;
      return {
        companyName: row.company_name,
        businessType: row.delivery_business_type,
        fleetManagerName: row.fleet_manager_name,
      };
    default:
      return null;
  }
}

const USER_SELECT = `
  SELECT u.*,
         dp.business_name,
         dp.business_type        AS donor_business_type,
         dp.representative_name  AS donor_representative,
         rp.organization_name,
         rp.organization_type,
         rp.representative_name  AS recipient_representative,
         dpl.company_name,
         dpl.business_type       AS delivery_business_type,
         dpl.fleet_manager_name
    FROM users u
    LEFT JOIN donor_profiles dp     ON dp.user_id = u.id
    LEFT JOIN recipient_profiles rp ON rp.user_id = u.id
    LEFT JOIN delivery_profiles dpl ON dpl.user_id = u.id
`;

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await query<UserDbRow>('SELECT * FROM users WHERE lower(email) = lower($1)', [
    email.trim(),
  ]);
  return result.rows[0] ? toUser(result.rows[0]) : null;
}

export async function findUserWithProfileById(id: string): Promise<UserWithProfile | null> {
  const result = await query<ProfileDbRow>(`${USER_SELECT} WHERE u.id = $1`, [id]);
  const row = result.rows[0];
  if (!row) return null;
  return { ...toSafeUser(row), profile: profileFor(row) };
}

export async function insertUser(
  client: PoolClient,
  input: {
    email: string;
    phone: string | null;
    passwordHash: string;
    role: Role;
    emailVerifiedAt?: string | null;
  },
): Promise<UserRecord> {
  const result = await client.query<UserDbRow>(
    `INSERT INTO users (email, phone, password_hash, role, email_verified_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.email.trim().toLowerCase(), input.phone, input.passwordHash, input.role, input.emailVerifiedAt ?? null],
  );
  return toUser(result.rows[0]);
}

export async function insertProfile(
  client: PoolClient,
  role: Role,
  userId: string,
  profile: Record<string, string>,
): Promise<void> {
  switch (role) {
    case 'donor':
      await client.query(
        `INSERT INTO donor_profiles (user_id, business_name, business_type, representative_name)
         VALUES ($1, $2, $3, $4)`,
        [userId, profile.businessName, profile.businessType, profile.representativeName],
      );
      break;
    case 'recipient':
      await client.query(
        `INSERT INTO recipient_profiles (user_id, organization_name, organization_type, representative_name)
         VALUES ($1, $2, $3, $4)`,
        [userId, profile.organizationName, profile.organizationType, profile.representativeName],
      );
      break;
    case 'delivery':
      await client.query(
        `INSERT INTO delivery_profiles (user_id, company_name, business_type, fleet_manager_name)
         VALUES ($1, $2, $3, $4)`,
        [userId, profile.companyName, profile.businessType, profile.fleetManagerName],
      );
      break;
    default:
      break;
  }
}

export async function updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
  await query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [
    userId,
    passwordHash,
  ]);
}

export async function markEmailVerified(userId: string): Promise<void> {
  await query(
    'UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1',
    [userId],
  );
}

export async function updateStatus(userId: string, status: AccountStatus): Promise<UserRecord | null> {
  const result = await query<UserDbRow>(
    'UPDATE users SET status = $2, updated_at = now() WHERE id = $1 RETURNING *',
    [userId, status],
  );
  return result.rows[0] ? toUser(result.rows[0]) : null;
}

export interface UserListFilter {
  role?: Role;
  status?: AccountStatus;
  search?: string;
  page: number;
  pageSize: number;
}

export interface UserListResult {
  users: UserWithProfile[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listUsers(filter: UserListFilter): Promise<UserListResult> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.role) {
    params.push(filter.role);
    conditions.push(`u.role = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    conditions.push(`u.status = $${params.length}`);
  }
  if (filter.search && filter.search.trim()) {
    params.push(`%${filter.search.trim()}%`);
    conditions.push(
      `(u.email ILIKE $${params.length}
        OR COALESCE(u.phone, '') ILIKE $${params.length}
        OR COALESCE(dp.business_name, '') ILIKE $${params.length}
        OR COALESCE(rp.organization_name, '') ILIKE $${params.length}
        OR COALESCE(dpl.company_name, '') ILIKE $${params.length})`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ total: string }>(
    `SELECT count(*)::text AS total
       FROM users u
       LEFT JOIN donor_profiles dp     ON dp.user_id = u.id
       LEFT JOIN recipient_profiles rp ON rp.user_id = u.id
       LEFT JOIN delivery_profiles dpl ON dpl.user_id = u.id
       ${where}`,
    params,
  );

  const offset = (filter.page - 1) * filter.pageSize;
  const rowsResult = await query<ProfileDbRow>(
    `${USER_SELECT}
     ${where}
     ORDER BY u.created_at DESC, u.email ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filter.pageSize, offset],
  );

  return {
    users: rowsResult.rows.map((row) => ({ ...toSafeUser(row), profile: profileFor(row) })),
    total: Number(countResult.rows[0]?.total ?? 0),
    page: filter.page,
    pageSize: filter.pageSize,
  };
}

export interface RoleCounts {
  role: Role;
  total: number;
  active: number;
  suspended: number;
  unverified: number;
}

export async function roleCounts(): Promise<RoleCounts[]> {
  const result = await query<{
    role: Role;
    total: string;
    active: string;
    suspended: string;
    unverified: string;
  }>(
    `SELECT role,
            count(*)::text AS total,
            count(*) FILTER (WHERE status = 'active')::text AS active,
            count(*) FILTER (WHERE status = 'suspended')::text AS suspended,
            count(*) FILTER (WHERE email_verified_at IS NULL)::text AS unverified
       FROM users
      GROUP BY role
      ORDER BY role`,
  );

  return result.rows.map((row) => ({
    role: row.role,
    total: Number(row.total),
    active: Number(row.active),
    suspended: Number(row.suspended),
    unverified: Number(row.unverified),
  }));
}

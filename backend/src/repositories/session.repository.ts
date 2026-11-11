import type { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { AccountStatus, Role } from '../types/auth';
import type { UserRecord } from './user.repository';

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  lastUsedAt: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  last_used_at: Date;
}

interface SessionUserRow extends SessionRow {
  u_id: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: Role;
  status: AccountStatus;
  email_verified_at: Date | null;
  user_created_at: Date;
  user_updated_at: Date;
}

function toSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    expiresAt: row.expires_at.toISOString(),
    revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    lastUsedAt: row.last_used_at.toISOString(),
  };
}

export async function createSession(input: {
  userId: string;
  tokenHash: string;
  expiresAt: string;
  userAgent: string | null;
  ip: string | null;
  client?: PoolClient;
}): Promise<string> {
  const runner = input.client ?? null;
  const sql = `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id`;
  const params = [input.userId, input.tokenHash, input.expiresAt, input.userAgent, input.ip];

  const result = runner
    ? await runner.query<{ id: string }>(sql, params)
    : await query<{ id: string }>(sql, params);

  return result.rows[0].id;
}

export interface SessionLookup {
  session: SessionRecord;
  user: UserRecord;
}

/** Resolves a raw session token hash to a live session and its user. */
export async function findSessionByTokenHash(tokenHash: string): Promise<SessionLookup | null> {
  const result = await query<SessionUserRow>(
    `SELECT s.id, s.user_id, s.expires_at, s.revoked_at, s.created_at, s.last_used_at,
            u.id            AS u_id,
            u.email, u.phone, u.password_hash, u.role, u.status, u.email_verified_at,
            u.created_at    AS user_created_at,
            u.updated_at    AS user_updated_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1`,
    [tokenHash],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    session: toSession(row),
    user: {
      id: row.u_id,
      email: row.email,
      phone: row.phone,
      passwordHash: row.password_hash,
      role: row.role,
      status: row.status,
      emailVerifiedAt: row.email_verified_at ? row.email_verified_at.toISOString() : null,
      createdAt: row.user_created_at.toISOString(),
      updatedAt: row.user_updated_at.toISOString(),
    },
  };
}

export async function touchSession(sessionId: string): Promise<void> {
  await query('UPDATE sessions SET last_used_at = now() WHERE id = $1', [sessionId]);
}

export async function revokeSession(sessionId: string): Promise<void> {
  await query('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [
    sessionId,
  ]);
}

export async function revokeAllSessionsForUser(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `WITH revoked AS (
       UPDATE sessions SET revoked_at = now()
        WHERE user_id = $1 AND revoked_at IS NULL
        RETURNING 1
     )
     SELECT count(*)::text AS count FROM revoked`,
    [userId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

/** Housekeeping: drop rows that can never be used again. */
export async function deleteDeadSessions(): Promise<number> {
  const result = await query<{ count: string }>(
    `WITH deleted AS (
       DELETE FROM sessions
        WHERE expires_at < now() OR revoked_at IS NOT NULL
        RETURNING 1
     )
     SELECT count(*)::text AS count FROM deleted`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

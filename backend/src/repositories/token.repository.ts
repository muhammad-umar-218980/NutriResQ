import { query } from '../db/pool';

export interface TokenPurpose {
  table: 'email_verifications' | 'password_resets';
}

/**
 * Issues a single-use token row. Any earlier unused token for the same user
 * and purpose is invalidated first, so only the newest link works.
 */
export async function issueToken(
  table: TokenPurpose['table'],
  userId: string,
  tokenHash: string,
  expiresAt: string,
): Promise<void> {
  await query(`UPDATE ${table} SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, [userId]);
  await query(`INSERT INTO ${table} (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [
    userId,
    tokenHash,
    expiresAt,
  ]);
}

/**
 * Atomically consumes a token: it must exist, be unused and be unexpired.
 * Returns the owning user id, or null when the token is not usable.
 */
export async function consumeToken(
  table: TokenPurpose['table'],
  tokenHash: string,
): Promise<string | null> {
  const result = await query<{ user_id: string }>(
    `UPDATE ${table}
        SET used_at = now()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [tokenHash],
  );
  return result.rows[0]?.user_id ?? null;
}

/** Housekeeping. */
export async function deleteExpiredTokens(): Promise<void> {
  await query('DELETE FROM email_verifications WHERE expires_at < now()');
  await query('DELETE FROM password_resets WHERE expires_at < now()');
}

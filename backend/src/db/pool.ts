import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from '../config/env';

/**
 * One pool per process. Neon requires TLS. The `sslmode` query parameter is
 * translated here instead of being handed to pg-connection-string, which logs a
 * deprecation warning for the libpq-compatible modes. Certificate verification
 * stays on unless the URL explicitly opts out.
 */
function connectionConfig(databaseUrl: string): { connectionString: string; ssl: boolean | { rejectUnauthorized: boolean } } {
  try {
    const url = new URL(databaseUrl);
    const sslmode = url.searchParams.get('sslmode');
    if (!sslmode) return { connectionString: databaseUrl, ssl: { rejectUnauthorized: true } };

    url.searchParams.delete('sslmode');
    const rejectUnauthorized = sslmode !== 'no-verify' && sslmode !== 'disable';
    return {
      connectionString: url.toString(),
      ssl: sslmode === 'disable' ? false : { rejectUnauthorized },
    };
  } catch {
    return { connectionString: databaseUrl, ssl: { rejectUnauthorized: true } };
  }
}

const pool = new Pool({
  ...connectionConfig(env.DATABASE_URL),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  application_name: 'nutriresq-api',
});

pool.on('error', (error) => {
  console.error('[db] idle client error:', error.message);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}

/** Runs `fn` inside BEGIN/COMMIT, rolling back on any throw. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Honest health probe: the caller reports what actually happened. */
export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const startedAt = Date.now();
  try {
    await pool.query('select 1');
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'unknown database error',
    };
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export { pool };

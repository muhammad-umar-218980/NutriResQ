import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PoolClient } from 'pg';
import { pool } from './pool';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');
const ADVISORY_LOCK_KEY = 727_272;

interface AppliedRow {
  id: string;
  checksum: string;
}

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function migrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((name) => name.endsWith('.sql')).sort();
}

/**
 * Applies every pending .sql file exactly once, in filename order.
 * A checksum mismatch means an already-applied file was edited, which would
 * make the database disagree with the repository, so it aborts loudly.
 */
export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  const client = await pool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
    await ensureMigrationsTable(client);

    const files = await migrationFiles();
    const existing = await client.query<AppliedRow>(
      'SELECT id, checksum FROM schema_migrations',
    );
    const checksums = new Map(existing.rows.map((row) => [row.id, row.checksum]));

    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = checksums.get(file);

      if (previous) {
        if (previous !== checksum) {
          throw new Error(
            `Migration ${file} changed after it was applied. ` +
              'Add a new migration instead of editing an applied one.',
          );
        }
        skipped.push(file);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)',
          [file, checksum],
        );
        await client.query('COMMIT');
        applied.push(file);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Migration ${file} failed: ${message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => undefined);
    client.release();
  }

  return { applied, skipped };
}

async function main(): Promise<void> {
  const { applied, skipped } = await runMigrations();
  if (applied.length === 0) {
    console.log(`Database is up to date (${skipped.length} migrations already applied).`);
  } else {
    console.log(`Applied ${applied.length} migration(s):`);
    for (const file of applied) console.log(`  + ${file}`);
  }
  await pool.end();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

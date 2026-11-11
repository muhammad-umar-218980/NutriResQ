import { env, isProduction } from '../config/env';
import { runMigrations } from './migrate';
import { pool } from './pool';
import { seedDatabase } from './seed';

function describeTarget(): string {
  try {
    const url = new URL(env.DATABASE_URL);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

/**
 * Destructive rebuild. Guarded three ways: an explicit --yes flag, a refusal
 * in production, and a printed target host so the operator can see which
 * database is about to be wiped.
 */
async function main(): Promise<void> {
  if (!process.argv.includes('--yes')) {
    console.error(
      [
        'db:reset drops every table in the target database.',
        '',
        `Target: ${describeTarget()}`,
        '',
        'Re-run with --yes to confirm:  npm run db:reset -- --yes',
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  if (isProduction) {
    console.error('Refusing to reset a database while NODE_ENV=production.');
    process.exitCode = 1;
    return;
  }

  console.log(`Resetting ${describeTarget()}`);

  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');

  const { applied } = await runMigrations();
  console.log(`Applied ${applied.length} migration(s).`);

  const lines = await seedDatabase();
  for (const line of lines) console.log(`  · ${line}`);

  console.log('Database reset complete.');
  await pool.end();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

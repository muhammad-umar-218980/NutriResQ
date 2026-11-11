import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pool, query } from './pool';

async function main(): Promise<void> {
  const applied = await query<{ id: string; applied_at: Date }>(
    'SELECT id, applied_at FROM schema_migrations ORDER BY id',
  ).catch(() => ({ rows: [] as Array<{ id: string; applied_at: Date }> }));

  const appliedIds = new Set(applied.rows.map((row) => row.id));
  const all = (await readdir(path.resolve(process.cwd(), 'migrations')))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const pending = all.filter((name) => !appliedIds.has(name));

  console.log(`Migrations: ${applied.rows.length} applied, ${pending.length} pending`);
  for (const row of applied.rows) {
    console.log(`  ✓ ${row.id}  (${row.applied_at.toISOString()})`);
  }
  for (const name of pending) console.log(`  · ${name}  (pending)`);

  const tables = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );

  console.log('\nRow counts');
  for (const { table_name } of tables.rows) {
    const count = await query<{ n: string }>(`SELECT count(*)::text AS n FROM "${table_name}"`);
    console.log(`  ${table_name.padEnd(24)} ${count.rows[0]?.n ?? '?'}`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

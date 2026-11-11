import { closePool, query } from '../db/pool';

async function main(): Promise<void> {
  const donorRemoved = await query<{ id: string; package_name: string }>(
    `DELETE FROM donations WHERE package_name LIKE 'QA smoke loaf%' RETURNING id, package_name`,
  );
  console.log('donor test packages removed:', donorRemoved.rows.length);

  const vehicleRemoved = await query<{ id: string; name: string }>(
    `DELETE FROM vehicles WHERE name LIKE 'QA Smoke Van%' RETURNING id, name`,
  );
  console.log('delivery test vehicles removed:', vehicleRemoved.rows.length);

  await closePool();
}

main();

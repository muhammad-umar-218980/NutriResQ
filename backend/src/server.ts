import 'dotenv/config';
import app from './app';
import { env } from './config/env';
import { closePool, pingDatabase } from './db/pool';

async function main(): Promise<void> {
  const database = await pingDatabase();
  if (!database.ok) {
    console.warn(`[server] database is not reachable: ${database.error ?? 'unknown error'}`);
  } else {
    console.log(`[server] database connected in ${database.latencyMs}ms`);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`NutriResQ API running at http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    console.log(`[server] ${signal} received, closing connections.`);
    server.close(() => {
      closePool()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[server] failed to start:', error);
  process.exit(1);
});

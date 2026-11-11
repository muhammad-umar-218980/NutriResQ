import 'dotenv/config';
import { z } from 'zod';

/**
 * The only module that reads process.env. DATABASE_URL never leaves the
 * backend process and is never included in an API response.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  /** Mixed into verification/reset token hashes. Rotating it invalidates them. */
  SESSION_TOKEN_PEPPER: z.string().min(16).default('dev-only-pepper-change-me'),

  ADMIN_EMAIL: z.string().email().default('admin@nutriresq.local'),
  ADMIN_PASSWORD: z.string().min(8).default('ChangeMe-Admin-2026'),

  /** Password for the seeded donor/recipient/delivery demo accounts. */
  DEMO_PASSWORD: z.string().min(8).default('Demo-Pass-2026'),

  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  REMEMBER_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /** Schema used by database integration tests. Dropped after each run. */
  TEST_SCHEMA: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/, 'TEST_SCHEMA must be a lowercase SQL identifier')
    .default('nutriresq_test'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}\n\nCopy .env.example to .env and fill it in.`);
  }

  return parsed.data;
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

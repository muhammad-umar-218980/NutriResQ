import type { NextFunction, Request, Response } from 'express';
import { RateLimitedError } from '../errors/app-error';

interface Bucket {
  failures: number;
  firstFailureAt: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const MAX_TRACKED_KEYS = 10_000;

const buckets = new Map<string, Bucket>();

function prune(now: number): void {
  if (buckets.size <= MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.firstFailureAt > WINDOW_MS) buckets.delete(key);
  }
}

function keyFor(req: Request): string {
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  return `${req.ip ?? 'unknown'}|${email}`;
}

/**
 * In-memory brute-force guard for the two login endpoints. Deliberately not a
 * dependency: one process, one counter, cleared on a successful sign-in.
 */
export function loginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  prune(now);

  const key = keyFor(req);
  const bucket = buckets.get(key);

  if (bucket && now - bucket.firstFailureAt > WINDOW_MS) {
    buckets.delete(key);
  }

  const active = buckets.get(key);
  if (active && active.failures >= MAX_FAILURES) {
    const retryAfterMs = WINDOW_MS - (now - active.firstFailureAt);
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
    next(new RateLimitedError('Too many sign-in attempts. Try again in a few minutes.'));
    return;
  }

  next();
}

/** Called after a successful login so one good attempt clears earlier failures. */
export function clearLoginAttempts(req: Request): void {
  buckets.delete(keyFor(req));
}

export function recordLoginFailure(req: Request): void {
  const key = keyFor(req);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.firstFailureAt > WINDOW_MS) {
    buckets.set(key, { failures: 1, firstFailureAt: now });
    return;
  }

  bucket.failures += 1;
}

/** Test hook. */
export function resetRateLimiter(): void {
  buckets.clear();
}

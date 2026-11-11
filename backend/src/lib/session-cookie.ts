import type { CookieOptions, Response } from 'express';
import { isProduction } from '../config/env';

export const SESSION_COOKIE = 'nrq_session';

/** Sets the session cookie with the lifetime the server actually issued. */
export function applySessionCookie(res: Response, token: string, expiresAt: string): void {
  const ttl = Math.max(1000, new Date(expiresAt).getTime() - Date.now());
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(ttl));
}

/**
 * HttpOnly keeps the token away from page scripts. SameSite=Lax covers
 * state-changing requests from other sites; the Origin check in
 * middleware/csrf.ts covers the rest.
 */
export function sessionCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function clearedCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
  };
}

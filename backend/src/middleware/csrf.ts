import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../errors/app-error';
import { env } from '../config/env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defence in depth for cookie-based auth: a state-changing request must come
 * from the configured frontend origin. SameSite=Lax already blocks cross-site
 * form posts; this also blocks a misconfigured same-site proxy.
 */
export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.header('origin');

  // Non-browser clients (tests, curl) send no Origin. Authentication still
  // applies, and forging a cookie without the token is impossible.
  if (!origin) {
    next();
    return;
  }

  const allowed = new Set([env.FRONTEND_URL, `http://localhost:${env.PORT}`]);
  if (!allowed.has(origin)) {
    next(new ForbiddenError('Requests must come from the configured frontend origin.'));
    return;
  }

  next();
}

import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error';
import { readCookie } from '../lib/cookies';
import { SESSION_COOKIE } from '../lib/session-cookie';
import { authenticateSession } from '../services/auth.service';
import type { Role } from '../types/auth';

/**
 * Cookie sessions: the browser sends the token automatically, the server
 * resolves it to a live session row. Revocation takes effect immediately.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const rawToken = readCookie(req, SESSION_COOKIE);
  if (!rawToken) {
    next(new UnauthorizedError());
    return;
  }

  const session = await authenticateSession(rawToken);
  if (!session) {
    next(new UnauthorizedError('Your session has expired. Please sign in again.'));
    return;
  }

  req.auth = {
    id: session.user.id,
    email: session.user.email,
    phone: session.user.phone,
    role: session.user.role,
    status: session.user.status,
    emailVerifiedAt: session.user.emailVerifiedAt,
    sessionId: session.sessionId,
  };

  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new ForbiddenError('This account is not allowed to use that resource.'));
      return;
    }
    next();
  };
}

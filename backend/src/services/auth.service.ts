import { env, isProduction } from '../config/env';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../errors/app-error';
import { createOpaqueToken, hashToken } from '../lib/opaque-token';
import { hashPassword, verifyPassword } from '../lib/password';
import { issueToken, consumeToken } from '../repositories/token.repository';
import {
  createSession,
  findSessionByTokenHash,
  revokeAllSessionsForUser,
  revokeSession,
  touchSession,
} from '../repositories/session.repository';
import {
  findUserByEmail,
  findUserWithProfileById,
  insertProfile,
  insertUser,
  markEmailVerified,
  updatePasswordHash,
  type UserRecord,
} from '../repositories/user.repository';
import type { PublicUser, Role } from '../types/auth';
import { withTransaction } from '../db/pool';

export type PortalRole = 'donor' | 'recipient' | 'delivery';

export interface RegisterInput {
  portal: PortalRole;
  email: string;
  phone: string;
  password: string;
  profile: Record<string, string>;
}

export interface LoginInput {
  /** A portal role, or 'admin' for the separate admin endpoint. */
  portal: Role;
  email: string;
  password: string;
  remember: boolean;
}

export interface SessionMeta {
  userAgent: string | null;
  ip: string | null;
}

export interface AuthSuccess {
  user: PublicUser;
  token: string;
  expiresAt: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const VERIFICATION_TTL_MS = 24 * HOUR_MS;
const RESET_TTL_MS = HOUR_MS;

function sessionTtlMs(remember: boolean): number {
  return remember ? env.REMEMBER_TTL_DAYS * DAY_MS : env.SESSION_TTL_HOURS * HOUR_MS;
}

function toPublicUser(
  user: Omit<UserRecord, 'passwordHash'>,
  profile: Record<string, string | null> | null,
): PublicUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    profile,
  };
}

async function startSession(
  user: UserRecord,
  remember: boolean,
  meta: SessionMeta,
): Promise<{ token: string; expiresAt: string }> {
  const token = createOpaqueToken();
  const ttl = sessionTtlMs(remember);
  const expiresAt = new Date(Date.now() + ttl);

  await createSession({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: expiresAt.toISOString(),
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  return { token, expiresAt: expiresAt.toISOString() };
}

/** Equalises timing so a missing account cannot be detected by response time. */
let dummyHash: string | null = null;
async function burnPasswordTime(password: string): Promise<void> {
  dummyHash ??= await hashPassword('this-is-not-a-real-password');
  await verifyPassword(password, dummyHash);
}

export async function registerUser(
  input: RegisterInput,
  meta: SessionMeta,
): Promise<AuthSuccess & { verificationToken?: string; verificationUrl?: string }> {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new ConflictError('An account with this email address already exists.');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await withTransaction(async (client) => {
    const created = await insertUser(client, {
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: input.portal,
    });
    await insertProfile(client, input.portal, created.id, input.profile);
    return created;
  });

  // Email delivery is not configured yet. The token is stored hashed either
  // way; outside production it is also returned so the flow stays testable.
  const verificationToken = createOpaqueToken();
  await issueToken(
    'email_verifications',
    user.id,
    hashToken(verificationToken),
    new Date(Date.now() + VERIFICATION_TTL_MS).toISOString(),
  );

  const session = await startSession(user, false, meta);

  const base = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  if (!isProduction) {
    console.log(`[auth] verification link for ${user.email}: ${base}`);
  }

  return {
    user: toPublicUser(user, input.profile),
    token: session.token,
    expiresAt: session.expiresAt,
    ...(isProduction
      ? {}
      : { verificationToken, verificationUrl: base }),
  };
}

export async function loginUser(input: LoginInput, meta: SessionMeta): Promise<AuthSuccess> {
  const user = await findUserByEmail(input.email);

  if (!user) {
    await burnPasswordTime(input.password);
    throw new UnauthorizedError('The email or password is incorrect.');
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash);
  if (!passwordOk) {
    throw new UnauthorizedError('The email or password is incorrect.');
  }

  if (user.status === 'suspended') {
    throw new ForbiddenError('This account has been suspended. Contact the NutriResQ team.');
  }

  if (input.portal === 'admin') {
    if (user.role !== 'admin') {
      throw new ForbiddenError('These credentials cannot sign in to the admin console.');
    }
  } else if (user.role === 'admin') {
    throw new ForbiddenError('Administrator accounts must sign in through the admin console.');
  } else if (user.role !== input.portal) {
    throw new ForbiddenError('This account belongs to a different portal.');
  }

  const session = await startSession(user, input.remember, meta);
  const withProfile = await findUserWithProfileById(user.id);

  return {
    user: toPublicUser(user, withProfile?.profile ?? null),
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

export interface AuthenticatedSession {
  user: PublicUser;
  sessionId: string;
}

export async function authenticateSession(rawToken: string): Promise<AuthenticatedSession | null> {
  const found = await findSessionByTokenHash(hashToken(rawToken));
  if (!found) return null;

  const { session, user } = found;
  if (session.revokedAt) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
  if (user.status === 'suspended') return null;

  await touchSession(session.id);

  const withProfile = await findUserWithProfileById(user.id);

  return {
    user: toPublicUser(user, withProfile?.profile ?? null),
    sessionId: session.id,
  };
}

export async function logoutSession(sessionId: string): Promise<void> {
  await revokeSession(sessionId);
}

export async function getPublicUser(userId: string): Promise<PublicUser | null> {
  const user = await findUserWithProfileById(userId);
  return user ? toPublicUser(user, user.profile) : null;
}

/**
 * Always resolves, whether or not the address exists: the API must not reveal
 * which emails are registered.
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ devToken?: string; devUrl?: string }> {
  const user = await findUserByEmail(email);
  if (!user) return {};

  const token = createOpaqueToken();
  await issueToken(
    'password_resets',
    user.id,
    hashToken(token),
    new Date(Date.now() + RESET_TTL_MS).toISOString(),
  );

  const url = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
  if (!isProduction) {
    console.log(`[auth] password reset link for ${user.email}: ${url}`);
  }

  return isProduction ? {} : { devToken: token, devUrl: url };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const userId = await consumeToken('password_resets', hashToken(token));
  if (!userId) {
    throw new UnauthorizedError('This reset link is invalid or has expired. Request a new one.');
  }

  const passwordHash = await hashPassword(newPassword);
  await updatePasswordHash(userId, passwordHash);
  // A password change signs out every existing session.
  await revokeAllSessionsForUser(userId);
}

export async function verifyEmailToken(token: string): Promise<{ email: string }> {
  const userId = await consumeToken('email_verifications', hashToken(token));
  if (!userId) {
    throw new UnauthorizedError('This verification link is invalid or has expired.');
  }

  await markEmailVerified(userId);
  const user = await findUserWithProfileById(userId);
  return { email: user?.email ?? '' };
}

export async function resendVerification(userId: string): Promise<{ devToken?: string; devUrl?: string }> {
  const user = await findUserWithProfileById(userId);
  if (!user) throw new UnauthorizedError('Session is no longer valid.');
  if (user.emailVerifiedAt) return {};

  const token = createOpaqueToken();
  await issueToken(
    'email_verifications',
    user.id,
    hashToken(token),
    new Date(Date.now() + VERIFICATION_TTL_MS).toISOString(),
  );

  const url = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
  if (!isProduction) console.log(`[auth] verification link for ${user.email}: ${url}`);

  return isProduction ? {} : { devToken: token, devUrl: url };
}

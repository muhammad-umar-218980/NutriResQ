import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env';

/** 256 bits of entropy, URL-safe. Only ever handed to the client. */
export function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Only hashes are stored. The pepper keeps a leaked database dump from being
 * replayable against a different deployment; the raw token is never persisted.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(env.SESSION_TOKEN_PEPPER).update(token).digest('hex');
}

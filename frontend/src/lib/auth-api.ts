import { apiRequest } from './api'
import type { ApiUser, AuthResult, LoginPayload, PortalId, RegistrationPayload, Role } from '../types/auth'

/**
 * Typed client for the authentication API.
 *
 * The server resolves the account role from the stored user record; the
 * `portal` value is a UI hint and is validated server-side. Nothing here ever
 * fakes a successful login or registration.
 */

const UNAVAILABLE_MESSAGE = 'Authentication service is not available yet.'

interface AuthResponse {
  success: boolean
  role?: Role
  user?: ApiUser
  message?: string
  verificationUrl?: string
}

interface MeResponse {
  success: boolean
  user: ApiUser
}

async function post(path: string, body: Record<string, unknown>): Promise<AuthResult> {
  try {
    const data = await apiRequest<AuthResponse>(path, { method: 'POST', body })
    return {
      ok: true,
      role: data.role,
      user: data.user,
      message: data.message,
      ...(data.verificationUrl ? { verificationUrl: data.verificationUrl } : {}),
    }
  } catch (error) {
    return failure(error)
  }
}

function failure(error: unknown): AuthResult {
  const status = (error as { status?: number }).status
  const message = error instanceof Error ? error.message : undefined

  if (status === 404 || status === 501 || status === 0) {
    return { ok: false, message: UNAVAILABLE_MESSAGE, unavailable: true }
  }

  return { ok: false, message }
}

export function login(payload: LoginPayload): Promise<AuthResult> {
  // `portal` is a UI hint. The server must resolve the account role from the
  // stored user record and reject a mismatch.
  return post('/api/auth/login', {
    portal: payload.portal,
    email: payload.email,
    password: payload.password,
    remember: payload.remember,
  })
}

export function register(payload: RegistrationPayload): Promise<AuthResult> {
  // The server assigns the role from `portal` only after validating the
  // registration; the client never chooses its own permissions.
  return post('/api/auth/register', {
    portal: payload.portal,
    email: payload.email,
    phone: payload.phone,
    password: payload.password,
    profile: payload.profile,
  })
}

export async function adminLogin(payload: {
  email: string
  password: string
  remember: boolean
}): Promise<AuthResult> {
  return post('/api/admin/auth/login', payload)
}

export function requestPasswordReset(email: string): Promise<AuthResult> {
  return post('/api/auth/forgot-password', { email })
}

export function resetPassword(token: string, password: string): Promise<AuthResult> {
  return post('/api/auth/reset-password', { token, password })
}

export function verifyEmail(token: string): Promise<AuthResult> {
  return post('/api/auth/verify-email', { token })
}

export async function resendVerification(): Promise<AuthResult> {
  return post('/api/auth/resend-verification', {})
}

export async function fetchCurrentUser(): Promise<ApiUser | null> {
  try {
    const data = await apiRequest<MeResponse>('/api/auth/me')
    return data.user
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 401) return null
    throw error
  }
}

export async function logout(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST' })
}

export function isPortalRole(role: Role | undefined): role is PortalId {
  return role === 'donor' || role === 'recipient' || role === 'delivery'
}

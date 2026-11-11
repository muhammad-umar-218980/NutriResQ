/**
 * Typed HTTP client for the NutriResQ API.
 *
 * The session lives in an HttpOnly cookie, so every request sends
 * `credentials: 'include'`. No token is ever stored in localStorage,
 * sessionStorage or the URL.
 */

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000'
).replace(/\/$/, '')

export interface ApiErrorPayload {
  code?: string
  message?: string
  details?: unknown
}

interface ErrorEnvelope {
  success?: boolean
  error?: ApiErrorPayload | string
  message?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** True when no backend endpoint answered at all. */
  get unavailable(): boolean {
    return this.status === 404 || this.status === 501 || this.status === 0
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

function resolveMessage(payload: ErrorEnvelope | null, status: number): string {
  if (payload) {
    const error = payload.error
    if (typeof error === 'string' && error.trim()) return error
    if (error && typeof error === 'object' && typeof error.message === 'string') {
      return error.message
    }
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message
  }

  switch (status) {
    case 401:
      return 'Your session has ended. Please sign in again.'
    case 403:
      return 'This account is not allowed to do that.'
    case 404:
      return 'That resource does not exist.'
    case 409:
      return 'That request conflicts with existing data.'
    case 422:
      return 'Check the highlighted fields and try again.'
    case 429:
      return 'Too many attempts. Please wait a moment and try again.'
    default:
      return status >= 500
        ? 'The service ran into a problem. Please try again.'
        : 'The request could not be completed.'
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      signal: options.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the NutriResQ service right now. Please try again later.',
    )
  }

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    // Empty or non-JSON body: there is simply no payload to report.
  }

  if (!response.ok) {
    const envelope = payload as ErrorEnvelope | null
    const errorCode =
      envelope && typeof envelope.error === 'object' && envelope.error?.code
        ? envelope.error.code
        : 'HTTP_ERROR'
    const details =
      envelope && typeof envelope.error === 'object' ? envelope.error.details : undefined

    throw new ApiError(response.status, errorCode, resolveMessage(envelope, response.status), details)
  }

  return payload as T
}

/** Returns null for a 401 instead of throwing: used to hydrate the session. */
export async function apiRequestOptional<T>(path: string): Promise<T | null> {
  try {
    return await apiRequest<T>(path)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

/** Flattens the server's `{ fields: {...} }` validation details. */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== 'object') {
    return {}
  }

  const fields = (error.details as { fields?: unknown }).fields
  if (!fields || typeof fields !== 'object') return {}

  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
    if (typeof value === 'string') {
      // Server keys look like `body.email`; the UI only needs the field name.
      result[key.split('.').slice(-1)[0]] = value
    }
  }
  return result
}

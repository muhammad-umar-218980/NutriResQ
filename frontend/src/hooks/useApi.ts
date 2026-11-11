import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'

interface SettledRequest<T> {
  requestKey: string
  data: T | null
  error: string | null
}

/**
 * Fetches one endpoint with cancellation and a manual reload.
 *
 * `path` is the only dependency, so callers encode filters into the path.
 * Loading is derived from which request has settled rather than written inside
 * the effect, which keeps every state update in an async callback.
 */
export function useApi<T>(path: string | null) {
  const [nonce, setNonce] = useState(0)
  const [result, setResult] = useState<SettledRequest<T> | null>(null)

  const requestKey = path === null ? null : `${path}::${nonce}`

  useEffect(() => {
    if (path === null || requestKey === null) return

    const controller = new AbortController()

    apiRequest<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ requestKey, data, error: null })
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResult({
          requestKey,
          data: null,
          error:
            error instanceof Error ? error.message : 'The request could not be completed.',
        })
      })

    return () => controller.abort()
  }, [path, requestKey])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  if (requestKey === null) {
    return { data: null, error: null, loading: false, reload }
  }

  const current = result && result.requestKey === requestKey ? result : null

  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: current === null,
    reload,
  }
}

/** Debounces a value; used for server-side search inputs. */
export function useDebounced<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

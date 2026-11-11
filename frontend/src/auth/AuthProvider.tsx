import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchCurrentUser, logout as logoutRequest } from '../lib/auth-api'
import type { ApiUser } from '../types/auth'
import { AuthContext, type AuthContextValue } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [unreachable, setUnreachable] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const next = await fetchCurrentUser()
      setUser(next)
      setUnreachable(false)
    } catch {
      // Network failure: keep any existing user but report the outage.
      setUnreachable(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // The session lives in an HttpOnly cookie, so the initial state has to be
    // read from the API. State updates land asynchronously inside refresh().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const signOut = useCallback(async () => {
    try {
      await logoutRequest()
    } catch {
      // A failed logout still clears local state; the cookie expires server-side.
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      loading,
      unreachable,
      setUser,
      refresh,
      signOut,
    }),
    [user, loading, unreachable, refresh, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

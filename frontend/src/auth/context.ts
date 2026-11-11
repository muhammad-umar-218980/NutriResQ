import { createContext, useContext } from 'react'
import type { ApiUser, Role } from '../types/auth'

export interface AuthContextValue {
  user: ApiUser | null
  role: Role | null
  /** True until the initial /me probe settles. */
  loading: boolean
  /** True when the API could not be reached at all (not a 401). */
  unreachable: boolean
  setUser: (user: ApiUser | null) => void
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.')
  return context
}

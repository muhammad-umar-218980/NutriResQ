import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context'
import { ROLE_HOME } from '../types/auth'
import type { Role } from '../types/auth'

function SessionGate() {
  return (
    <div className="session-gate" role="status" aria-live="polite">
      <span className="session-gate__pulse" aria-hidden="true" />
      Checking your session…
    </div>
  )
}

/**
 * Route guard. The server is the source of truth for the role; this only
 * decides which screen to render so a signed-in user never sees another
 * role's workspace.
 */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <SessionGate />

  if (!user) {
    const target =
      role === 'admin' ? '/admin/login' : `/auth?mode=login&portal=${role}`
    return <Navigate to={target} replace state={{ from: location.pathname }} />
  }

  if (user.role !== role) {
    return <Navigate to={ROLE_HOME[user.role]} replace />
  }

  return <>{children}</>
}

/** Keeps a signed-in user away from the sign-in screens. */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <SessionGate />
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />

  return <>{children}</>
}

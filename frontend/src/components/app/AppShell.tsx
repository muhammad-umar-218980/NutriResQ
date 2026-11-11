import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import BrandMark from '../BrandMark'
import { useAuth } from '../../auth/context'
import { ROLE_LABEL } from '../../types/auth'
import './AppShell.css'

export interface AppNavItem {
  label: string
  to: string
  end?: boolean
}

interface AppShellProps {
  /** Small uppercase label next to the wordmark. */
  workspace: string
  nav: AppNavItem[]
  children: ReactNode
}

/**
 * Shared chrome for every signed-in workspace: brand, role-scoped navigation,
 * the signed-in account and sign out. Reuses the landing page palette.
 */
export default function AppShell({ workspace, nav, children }: AppShellProps) {
  const { user, signOut } = useAuth()

  useEffect(() => {
    const previous = document.title
    document.title = `${workspace} · NutriResQ`
    return () => {
      document.title = previous
    }
  }, [workspace])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to dashboard content
      </a>

      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-brand">
            <BrandMark size={28} />
            <span className="app-brand__name">NutriResQ</span>
            <span className="app-brand__workspace">{workspace}</span>
          </div>

          <nav className="app-nav" aria-label={`${workspace} navigation`}>
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? 'app-nav__link is-active' : 'app-nav__link'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="app-account">
            {user ? (
              <>
                <span className="app-account__meta">
                  <span className="app-account__email">{user.email}</span>
                  <span className="app-account__role">{ROLE_LABEL[user.role]}</span>
                </span>
                <button type="button" className="btn-secondary btn-secondary--small" onClick={() => void signOut()}>
                  Sign out
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="app-main" id="workspace-main">
        {children}
      </main>
    </div>
  )
}

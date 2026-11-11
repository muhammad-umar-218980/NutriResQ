import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from 'lucide-react'
import BrandMark from '../BrandMark'
import { useAuth } from '../../auth/context'
import { ROLE_LABEL } from '../../types/auth'
import './AppShell.css'

export interface AppNavItem {
  label: string
  to: string
  end?: boolean
  icon: LucideIcon
}

interface AppShellProps {
  /** Small uppercase label next to the wordmark. */
  workspace: string
  nav: AppNavItem[]
  children: ReactNode
}

const SIDEBAR_STORAGE_KEY = 'nutriresq:sidebar-collapsed'

function readStoredCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Shared chrome for every signed-in workspace: brand, a collapsible sidebar
 * with role-scoped navigation and sign out at the bottom, plus a slide-in
 * drawer below 900px. Reuses the landing page palette.
 */
export default function AppShell({ workspace, nav, children }: AppShellProps) {
  const { user, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(readStoredCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const previous = document.title
    document.title = `${workspace} · NutriResQ`
    return () => {
      document.title = previous
    }
  }, [workspace])

  // Remember the desktop rail state between visits.
  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
    } catch {
      // Storage can be unavailable (private mode); the rail still works.
    }
  }, [collapsed])

  // Escape closes the drawer, focus returns to the trigger and the page
  // behind the drawer does not scroll while it is open.
  useEffect(() => {
    if (!mobileOpen) return

    const firstLink = sidebarRef.current?.querySelector<HTMLAnchorElement>(
      '.app-sidebar__link',
    )
    firstLink?.focus({ preventScroll: true })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        menuButtonRef.current?.focus()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileOpen])

  // Leaving the mobile breakpoint while the drawer is open must release the
  // scroll lock, but never overrides the user's desktop preference.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 901px)')
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false)
    }
    desktop.addEventListener('change', handleChange)
    return () => desktop.removeEventListener('change', handleChange)
  }, [])

  return (
    <div className={`app-shell ${collapsed ? 'app-shell--collapsed' : ''}`}>
      <a className="skip-link" href="#workspace-main">
        Skip to dashboard content
      </a>

      <header className="app-mobilebar">
        <button
          ref={menuButtonRef}
          type="button"
          className="app-mobilebar__menu"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
          aria-controls="app-sidebar"
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          <Menu size={20} strokeWidth={1.9} aria-hidden="true" />
        </button>
        <div className="app-mobilebar__brand">
          <BrandMark size={24} tone="nav" />
          <span className="app-brand__name">NutriResQ</span>
          <span className="app-brand__workspace">{workspace}</span>
        </div>
      </header>

      <button
        type="button"
        className={`app-scrim ${mobileOpen ? 'app-scrim--visible' : ''}`}
        aria-label="Close navigation"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        id="app-sidebar"
        ref={sidebarRef}
        className={`app-sidebar ${collapsed ? 'app-sidebar--collapsed' : ''} ${
          mobileOpen ? 'app-sidebar--open' : ''
        }`}
        aria-label={`${workspace} navigation`}
      >
        <div className="app-sidebar__top">
          <div className="app-sidebar__brand">
            <BrandMark size={28} tone="nav" />
            <span className="app-sidebar__brand-text">
              <span className="app-sidebar__brand-name">NutriResQ</span>
              <span className="app-sidebar__brand-workspace">
                {workspace}
              </span>
            </span>
          </div>

          <button
            type="button"
            className="app-sidebar__collapse"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((prev) => !prev)}
          >
            {collapsed ? (
              <PanelLeftOpen size={20} strokeWidth={1.9} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={20} strokeWidth={1.9} aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            className="app-sidebar__close"
            aria-label="Close navigation"
            onClick={() => {
              setMobileOpen(false)
              menuButtonRef.current?.focus()
            }}
          >
            <X size={20} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </div>

        <nav className="app-sidebar__nav">
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-tooltip={item.label}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  isActive
                    ? 'app-sidebar__link app-sidebar__link--active'
                    : 'app-sidebar__link'
                }
              >
                <span className="app-sidebar__link-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.9} />
                </span>
                <span className="app-sidebar__link-label">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="app-sidebar__footer">
          {user ? (
            <>
              <p className="app-sidebar__account">
                <span className="app-sidebar__account-email">{user.email}</span>
                <span className="app-sidebar__account-role">
                  {ROLE_LABEL[user.role]}
                </span>
              </p>
              <button
                type="button"
                className="app-sidebar__logout"
                data-tooltip="Sign out"
                aria-label="Sign out"
                onClick={() => void signOut()}
              >
                <LogOut
                  className="app-sidebar__logout-icon"
                  size={20}
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
                <span className="app-sidebar__logout-label">Sign out</span>
              </button>
            </>
          ) : null}
        </div>
      </aside>

      <main className="app-main" id="workspace-main">
        {children}
      </main>
    </div>
  )
}

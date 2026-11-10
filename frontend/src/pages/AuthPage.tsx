import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthBrand from '../components/auth/AuthBrand'
import AuthStage from '../components/auth/AuthStage'
import PortalSelector from '../components/auth/PortalSelector'
import { PORTALS, isPortalId } from '../config/auth-portals'
import type { AuthMode, PortalId } from '../types/auth'
import './AuthPage.css'

const DEFAULT_PORTAL: PortalId = 'donor'
const DEFAULT_MODE: AuthMode = 'signup'

function readMode(value: string | null): AuthMode {
  return value === 'login' ? 'login' : DEFAULT_MODE
}

export default function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const previousTitle = useRef(document.title)

  const portalParam = searchParams.get('portal')
  const modeParam = searchParams.get('mode')
  const portal = isPortalId(portalParam) ? portalParam : DEFAULT_PORTAL
  const mode = readMode(modeParam)
  const portalConfig = PORTALS[portal]

  // Keep the URL explicit and valid, even when the page is opened without
  // parameters or with an unknown portal value.
  useEffect(() => {
    const portalIsValid = isPortalId(portalParam)
    const modeIsValid = modeParam === 'login' || modeParam === 'signup'
    if (portalIsValid && modeIsValid) return

    const next = new URLSearchParams(searchParams)
    next.set('portal', portalIsValid && portalParam ? portalParam : DEFAULT_PORTAL)
    next.set('mode', modeIsValid && modeParam ? modeParam : DEFAULT_MODE)
    setSearchParams(next, { replace: true })
  }, [portalParam, modeParam, searchParams, setSearchParams])

  useEffect(() => {
    const previous = previousTitle.current
    document.title = `${portalConfig.label} · ${
      mode === 'signup' ? 'Registration' : 'Sign In'
    } | NutriResQ`

    return () => {
      document.title = previous
    }
  }, [portalConfig.label, mode])

  function updateLocation(nextPortal: PortalId, nextMode: AuthMode) {
    setSearchParams(
      { portal: nextPortal, mode: nextMode },
      { replace: true },
    )
  }

  return (
    <div className="auth-shell">
      <a className="skip-link" href="#auth-main">
        Skip to authentication
      </a>

      <header className="auth-header">
        <AuthBrand />
        <PortalSelector
          value={portal}
          onChange={(nextPortal) => updateLocation(nextPortal, mode)}
        />
      </header>

      <main className="auth-main" id="auth-main">
        <p className="auth-lead">
          One network connecting surplus food with the communities that need it.
        </p>

        <div className="auth-mode" role="group" aria-label="Sign in or create an account">
          <button
            type="button"
            className="auth-mode__option"
            aria-pressed={mode === 'login'}
            onClick={() => updateLocation(portal, 'login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className="auth-mode__option"
            aria-pressed={mode === 'signup'}
            onClick={() => updateLocation(portal, 'signup')}
          >
            Create Account
          </button>
        </div>

        <AuthStage
          mode={mode}
          portal={portal}
          onModeChange={(nextMode) => updateLocation(portal, nextMode)}
        />

        <div className="auth-footer">
          <Link className="auth-back" to="/">
            <span aria-hidden="true">←</span> Back to homepage
          </Link>
        </div>
      </main>

      <p className="visually-hidden" role="status">
        {mode === 'signup'
          ? `Registration form for ${portalConfig.label}`
          : `Sign in form for ${portalConfig.label}`}
      </p>
    </div>
  )
}

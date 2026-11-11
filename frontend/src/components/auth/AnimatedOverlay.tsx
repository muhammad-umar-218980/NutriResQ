import { PORTALS } from '../../config/auth-portals'
import type { AuthMode, PortalId } from '../../types/auth'

interface AnimatedOverlayProps {
  mode: AuthMode
  portal: PortalId
  onModeChange: (mode: AuthMode) => void
}

/**
 * The rust overlay from the classic double-slider pattern. Both faces live on
 * one 200%-wide strip that stays aligned with the card while the visible
 * window slides, so the copy is wiped into view rather than faded.
 *
 * The face that is not on screen is inert and hidden from assistive tech even
 * though it is still painted inside the clipped container.
 */
export default function AnimatedOverlay({
  mode,
  portal,
  onModeChange,
}: AnimatedOverlayProps) {
  const signupActive = mode === 'signup'

  return (
    <div className="overlay-container">
      <div className="overlay">
        <div
          className={
            signupActive
              ? 'overlay-face overlay-face--left is-active'
              : 'overlay-face overlay-face--left'
          }
          inert={!signupActive}
          aria-hidden={!signupActive}
        >
          <p className="overlay-eyebrow">{PORTALS[portal].label}</p>
          <h2>Welcome Back!</h2>
          <p>Continue making a difference through NutriResQ.</p>
          <button
            type="button"
            className="ghost-button"
            onClick={() => onModeChange('login')}
          >
            Sign In
          </button>
        </div>

        <div
          className={
            signupActive
              ? 'overlay-face overlay-face--right'
              : 'overlay-face overlay-face--right is-active'
          }
          inert={signupActive}
          aria-hidden={signupActive}
        >
          <p className="overlay-eyebrow">{PORTALS[portal].label}</p>
          <h2>Hello, Friend!</h2>
          <p>Enter your details and become part of a smarter food rescue network.</p>
          <button
            type="button"
            className="ghost-button"
            onClick={() => onModeChange('signup')}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  )
}

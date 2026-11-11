import { useEffect, useRef } from 'react'
import type { AuthMode, PortalId } from '../../types/auth'
import AnimatedOverlay from './AnimatedOverlay'
import LoginForm from './LoginForm'
import RegistrationForm from './RegistrationForm'

interface AuthStageProps {
  mode: AuthMode
  portal: PortalId
  onModeChange: (mode: AuthMode) => void
}

/**
 * Both panels share one CSS grid cell, so the card takes the height of the
 * taller form. All seven registration fields stay visible without clipping.
 * The inactive panel is inert, so its inputs never enter the tab order.
 */
export default function AuthStage({ mode, portal, onModeChange }: AuthStageProps) {
  const signupActive = mode === 'signup'
  const previousMode = useRef(mode)

  // The overlay button that triggered a switch becomes inert, so move focus
  // into the newly active form instead of dropping it on the document body.
  useEffect(() => {
    if (previousMode.current === mode) return
    previousMode.current = mode

    const formId = signupActive ? 'registration-form' : 'login-form'
    const firstField = document
      .getElementById(formId)
      ?.querySelector<HTMLInputElement>('input, select')

    firstField?.focus({ preventScroll: true })
  }, [mode, signupActive])

  return (
    <div className={signupActive ? 'auth-card is-signup' : 'auth-card'}>
      <section
        className="auth-panel auth-panel--login"
        aria-labelledby="login-heading"
        inert={signupActive}
        aria-hidden={signupActive}
      >
        <LoginForm portal={portal} />
      </section>

      <section
        className="auth-panel auth-panel--signup"
        aria-labelledby="signup-heading"
        inert={!signupActive}
        aria-hidden={!signupActive}
      >
        <RegistrationForm portal={portal} />
      </section>

      <AnimatedOverlay mode={mode} portal={portal} onModeChange={onModeChange} />
    </div>
  )
}

import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/context'
import { PORTALS } from '../../config/auth-portals'
import { login } from '../../lib/auth-api'
import { validateLogin } from '../../lib/auth-validation'
import type { FieldErrors } from '../../lib/auth-validation'
import { ROLE_HOME, type PortalId } from '../../types/auth'
import PasswordInput from './PasswordInput'
import { TextField } from './fields'

interface LoginFormProps {
  portal: PortalId
}

interface FormStatus {
  tone: 'error' | 'ok'
  message: string
}

export default function LoginForm({ portal }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<FormStatus | null>(null)
  const [pending, setPending] = useState(false)

  const formRef = useRef<HTMLFormElement>(null)
  const portalConfig = PORTALS[portal]
  const navigate = useNavigate()
  const { setUser } = useAuth()

  function clearError(name: string) {
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const nextErrors = validateLogin({ email, password })
    setErrors(nextErrors)
    setStatus(null)

    if (Object.keys(nextErrors).length > 0) {
      const firstField = Object.keys(nextErrors)[0]
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${firstField}"]`)
        ?.focus()
      return
    }

    setPending(true)
    const result = await login({
      portal,
      email: email.trim(),
      password,
      remember,
    })
    setPending(false)

    if (!result.ok) {
      setStatus({
        tone: 'error',
        message: result.message ?? 'Sign in failed. Please try again.',
      })
      return
    }

    // The portal is only a UI hint. The role returned by the server decides
    // whether this sign-in is allowed.
    if (result.role && result.role !== portal) {
      if (result.role === 'admin') {
        setStatus({
          tone: 'error',
          message: 'Administrator accounts must sign in through the separate admin portal.',
        })
      } else {
        const correctPortal = PORTALS[result.role]
        setStatus({
          tone: 'error',
          message: `This account belongs to the ${correctPortal.label} portal. Select ${correctPortal.label} above to continue.`,
        })
      }
      return
    }

    if (!result.user || !result.role) {
      setStatus({
        tone: 'error',
        message: 'The server did not confirm the session. Please try again.',
      })
      return
    }

    // The session cookie is set by the server; this only updates the UI state.
    setUser(result.user)
    navigate(ROLE_HOME[result.role], { replace: true })
  }

  return (
    <form
      className="auth-form"
      id="login-form"
      ref={formRef}
      noValidate
      aria-busy={pending}
      onSubmit={handleSubmit}
    >
      <p className="eyebrow">{portalConfig.label}</p>
      <h1 id="login-heading">Welcome Back!</h1>
      <p className="auth-form__desc">Sign in to continue to your NutriResQ account.</p>

      <div className="auth-fields">
        <TextField
          id="login-email"
          name="email"
          label="Email Address"
          type="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(value) => {
            setEmail(value)
            clearError('email')
          }}
        />

        <PasswordInput
          id="login-password"
          name="password"
          label="Password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(value) => {
            setPassword(value)
            clearError('password')
          }}
        />
      </div>

      <div className="form-options">
        <label className="checkbox">
          <input
            type="checkbox"
            name="remember"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          Remember me
        </label>
        <Link className="auth-link" to="/forgot-password">
          Forgot password?
        </Link>
      </div>

      {status ? (
        <p
          className={`form-status form-status--${status.tone}`}
          role={status.tone === 'error' ? 'alert' : 'status'}
        >
          {status.message}
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}

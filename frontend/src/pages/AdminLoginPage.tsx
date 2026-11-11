import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthBrand from '../components/auth/AuthBrand'
import PasswordInput from '../components/auth/PasswordInput'
import { TextField } from '../components/auth/fields'
import { useAuth } from '../auth/context'
import { adminLogin } from '../lib/auth-api'
import './AuthPage.css'

/**
 * The admin console entry point. Deliberately not linked from any public
 * screen: it is reached by typing the URL. The routine is protected by the
 * password plus the shared login rate limiter, not by obscurity alone.
 */
export default function AdminLoginPage() {
  const navigate = useNavigate()
  const { setUser, user } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [status, setStatus] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const previous = document.title
    document.title = 'Administrator sign in | NutriResQ'

    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)

    return () => {
      document.title = previous
      meta.remove()
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'admin') navigate('/admin', { replace: true })
  }, [user, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    if (!email.trim()) {
      setError('Enter the administrator email address.')
      return
    }
    if (!password) {
      setError('Enter the administrator password.')
      return
    }

    setError(undefined)
    setStatus(null)
    setPending(true)
    const result = await adminLogin({ email: email.trim(), password, remember })
    setPending(false)

    if (!result.ok || !result.user) {
      setStatus(result.message ?? 'Sign in failed. Please try again.')
      return
    }

    setUser(result.user)
    navigate('/admin', { replace: true })
  }

  return (
    <div className="auth-shell">
      <a className="skip-link" href="#admin-main">
        Skip to administrator sign in
      </a>

      <header className="auth-header">
        <AuthBrand />
        <p className="admin-login__tag">Administration</p>
      </header>

      <main className="auth-main auth-main--simple" id="admin-main">
        <div className="auth-card auth-card--simple">
          <p className="eyebrow">Restricted access</p>
          <h1>Administrator sign in</h1>
          <p className="auth-form__desc">
            This console manages accounts and runs the rescue optimization. It is
            not part of the public portal.
          </p>

          <form className="auth-simple__form" noValidate onSubmit={handleSubmit}>
            <TextField
              id="admin-email"
              name="email"
              label="Email Address"
              type="email"
              autoComplete="username"
              value={email}
              error={error}
              onChange={(value) => {
                setEmail(value)
                setError(undefined)
              }}
            />

            <PasswordInput
              id="admin-password"
              name="password"
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={(value) => {
                setPassword(value)
                setError(undefined)
              }}
            />

            <label className="checkbox">
              <input
                type="checkbox"
                name="remember"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              Keep me signed in on this device
            </label>

            {status ? (
              <p className="form-status form-status--error" role="alert">
                {status}
              </p>
            ) : null}

            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

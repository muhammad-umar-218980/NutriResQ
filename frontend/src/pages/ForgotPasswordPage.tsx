import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AuthBrand from '../components/auth/AuthBrand'
import { TextField } from '../components/auth/fields'
import { requestPasswordReset } from '../lib/auth-api'
import { validateEmail } from '../lib/auth-validation'
import './AuthPage.css'

interface FormStatus {
  tone: 'error' | 'ok'
  message: string
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [status, setStatus] = useState<FormStatus | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const previous = document.title
    document.title = 'Reset your password | NutriResQ'
    return () => {
      document.title = previous
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const emailError = validateEmail(email)
    setError(emailError)
    setStatus(null)

    if (emailError) return

    setPending(true)
    const result = await requestPasswordReset(email.trim())
    setPending(false)

    if (!result.ok) {
      setStatus({
        tone: 'error',
        message: result.message ?? 'The reset request could not be sent.',
      })
      return
    }

    setStatus({
      tone: 'ok',
      message:
        result.message ??
        'If that email address is registered, a reset link is on its way.',
    })
  }

  return (
    <div className="auth-shell">
      <a className="skip-link" href="#auth-main">
        Skip to password recovery
      </a>

      <header className="auth-header">
        <AuthBrand />
      </header>

      <main className="auth-main auth-main--simple" id="auth-main">
        <div className="auth-card auth-card--simple">
          <p className="eyebrow">Account recovery</p>
          <h1>Reset your password</h1>
          <p className="auth-form__desc">
            Enter the email address linked to your NutriResQ account and we will
            send reset instructions if the account exists.
          </p>

          <form className="auth-simple__form" noValidate onSubmit={handleSubmit}>
            <TextField
              id="reset-email"
              name="email"
              label="Email Address"
              type="email"
              autoComplete="email"
              value={email}
              error={error}
              onChange={(value) => {
                setEmail(value)
                setError(undefined)
              }}
            />

            {status ? (
              <p
                className={`form-status form-status--${status.tone}`}
                role={status.tone === 'error' ? 'alert' : 'status'}
              >
                {status.message}
              </p>
            ) : null}

            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>

          <Link className="auth-back" to="/auth?mode=login">
            <span aria-hidden="true">←</span> Back to sign in
          </Link>
        </div>
      </main>
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthBrand from '../components/auth/AuthBrand'
import { TextField } from '../components/auth/fields'
import { verifyEmail } from '../lib/auth-api'
import './AuthPage.css'

interface FormStatus {
  tone: 'error' | 'ok'
  message: string
}

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState(() => searchParams.get('token') ?? '')
  const [error, setError] = useState<string | undefined>()
  const [status, setStatus] = useState<FormStatus | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const previous = document.title
    document.title = 'Verify your email | NutriResQ'
    return () => {
      document.title = previous
    }
  }, [])

  const hasTokenInUrl = Boolean(searchParams.get('token'))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    if (!token.trim()) {
      setError('Enter the verification token from your email.')
      setStatus(null)
      return
    }

    setError(undefined)
    setStatus(null)
    setPending(true)
    const result = await verifyEmail(token.trim())
    setPending(false)

    if (!result.ok) {
      setStatus({
        tone: 'error',
        message: result.message ?? 'This email could not be verified.',
      })
      return
    }

    setStatus({
      tone: 'ok',
      message: result.message ?? 'Your email address has been verified.',
    })
  }

  return (
    <div className="auth-shell">
      <a className="skip-link" href="#auth-main">
        Skip to email verification
      </a>

      <header className="auth-header">
        <AuthBrand />
      </header>

      <main className="auth-main auth-main--simple" id="auth-main">
        <div className="auth-card auth-card--simple">
          <p className="eyebrow">Email verification</p>
          <h1>Verify your email</h1>
          <p className="auth-form__desc">
            {hasTokenInUrl
              ? 'Confirm the token from your verification email to activate your NutriResQ account.'
              : 'Open the verification link from your email, or paste the token it contains below.'}
          </p>

          <form className="auth-simple__form" noValidate onSubmit={handleSubmit}>
            <TextField
              id="verify-token"
              name="token"
              label="Verification Token"
              type="text"
              autoComplete="off"
              value={token}
              error={error}
              hint={
                hasTokenInUrl
                  ? 'The token from your link is filled in already.'
                  : undefined
              }
              onChange={(value) => {
                setToken(value)
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
              {pending ? 'Verifying…' : 'Verify Email'}
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

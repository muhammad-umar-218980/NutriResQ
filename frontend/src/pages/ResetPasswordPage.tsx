import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthBrand from '../components/auth/AuthBrand'
import PasswordInput from '../components/auth/PasswordInput'
import { resetPassword } from '../lib/auth-api'
import './AuthPage.css'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [status, setStatus] = useState<{ tone: 'error' | 'ok'; message: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const previous = document.title
    document.title = 'Choose a new password | NutriResQ'
    return () => {
      document.title = previous
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const next: { password?: string; confirm?: string } = {}
    if (password.length < 8) next.password = 'Use at least 8 characters.'
    if (confirm !== password) next.confirm = 'Passwords do not match.'
    setErrors(next)
    setStatus(null)

    if (!token) {
      setStatus({ tone: 'error', message: 'This page needs a reset token from your email link.' })
      return
    }
    if (Object.keys(next).length > 0) return

    setPending(true)
    const result = await resetPassword(token, password)
    setPending(false)

    if (!result.ok) {
      setStatus({
        tone: 'error',
        message: result.message ?? 'The password could not be updated.',
      })
      return
    }

    setDone(true)
    setStatus({ tone: 'ok', message: result.message ?? 'Your password has been updated.' })
  }

  return (
    <div className="auth-shell">
      <a className="skip-link" href="#auth-main">
        Skip to password reset
      </a>

      <header className="auth-header">
        <AuthBrand />
      </header>

      <main className="auth-main auth-main--simple" id="auth-main">
        <div className="auth-card auth-card--simple">
          <p className="eyebrow">Account recovery</p>
          <h1>Choose a new password</h1>
          <p className="auth-form__desc">
            Setting a new password signs out every other device using this account.
          </p>

          <form className="auth-simple__form" noValidate onSubmit={handleSubmit}>
            <PasswordInput
              id="new-password"
              name="password"
              label="New Password"
              autoComplete="new-password"
              value={password}
              error={errors.password}
              hint="Use at least 8 characters."
              onChange={(value) => {
                setPassword(value)
                setErrors((current) => ({ ...current, password: undefined }))
              }}
            />

            <PasswordInput
              id="confirm-password"
              name="confirmPassword"
              label="Confirm New Password"
              autoComplete="new-password"
              value={confirm}
              error={errors.confirm}
              onChange={(value) => {
                setConfirm(value)
                setErrors((current) => ({ ...current, confirm: undefined }))
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

            {done ? (
              <Link className="btn-primary" to="/auth?mode=login">
                Continue to sign in
              </Link>
            ) : (
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending ? 'Updating…' : 'Update Password'}
              </button>
            )}
          </form>

          {!done ? (
            <Link className="auth-back" to="/auth?mode=login">
              <span aria-hidden="true">←</span> Back to sign in
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  )
}

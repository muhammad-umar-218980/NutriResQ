import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/context'
import { PORTAL_ORDER, PORTALS } from '../../config/auth-portals'
import { register } from '../../lib/auth-api'
import { validateRegistration } from '../../lib/auth-validation'
import type { FieldErrors } from '../../lib/auth-validation'
import { ROLE_HOME, type PortalId } from '../../types/auth'
import PasswordInput from './PasswordInput'
import { SelectField, TextField } from './fields'

interface RegistrationFormProps {
  portal: PortalId
}

interface FormStatus {
  tone: 'error' | 'ok'
  message: string
}

type Drafts = Record<PortalId, Record<string, string>>

const EMPTY_ERRORS: FieldErrors = {}

function createDrafts(): Drafts {
  const drafts: Drafts = { donor: {}, recipient: {}, delivery: {} }

  for (const portal of PORTAL_ORDER) {
    for (const field of PORTALS[portal].fields) {
      drafts[portal][field.name] = ''
    }
  }

  return drafts
}

export default function RegistrationForm({ portal }: RegistrationFormProps) {
  const [drafts, setDrafts] = useState<Drafts>(createDrafts)
  const [errorsByPortal, setErrorsByPortal] = useState<
    Partial<Record<PortalId, FieldErrors>>
  >({})
  const [statusByPortal, setStatusByPortal] = useState<
    Partial<Record<PortalId, FormStatus>>
  >({})
  const [pending, setPending] = useState(false)

  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const config = PORTALS[portal]
  const values = drafts[portal]
  const errors = errorsByPortal[portal] ?? EMPTY_ERRORS
  const status = statusByPortal[portal] ?? null

  function setField(name: string, value: string) {
    setDrafts((current) => ({
      ...current,
      [portal]: { ...current[portal], [name]: value },
    }))
    setErrorsByPortal((current) => {
      const portalErrors = current[portal]
      if (!portalErrors?.[name]) return current
      const nextPortalErrors = { ...portalErrors }
      delete nextPortalErrors[name]
      return { ...current, [portal]: nextPortalErrors }
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    // Capture the portal at submit time so a switch mid-request cannot post
    // one portal's draft under another portal's role.
    const submittedPortal = portal
    const submittedConfig = PORTALS[submittedPortal]
    const submittedValues = drafts[submittedPortal]
    const nextErrors = validateRegistration(submittedConfig.fields, submittedValues)

    setErrorsByPortal((current) => ({
      ...current,
      [submittedPortal]: nextErrors,
    }))
    setStatusByPortal((current) => ({
      ...current,
      [submittedPortal]: undefined,
    }))

    if (Object.keys(nextErrors).length > 0) {
      const firstField = Object.keys(nextErrors)[0]
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${firstField}"]`)
        ?.focus()
      return
    }

    const profile: Record<string, string> = {}
    let email = ''
    let phone = ''
    let password = ''

    for (const field of submittedConfig.fields) {
      const rawValue = submittedValues[field.name] ?? ''

      if (field.type === 'email') {
        email = rawValue.trim()
      } else if (field.type === 'tel') {
        phone = rawValue.trim()
      } else if (field.type === 'password') {
        if (field.name === 'password') password = rawValue
      } else {
        profile[field.name] = rawValue.trim()
      }
    }

    setPending(true)
    const result = await register({
      portal: submittedPortal,
      email,
      phone,
      password,
      profile,
    })
    setPending(false)

    setStatusByPortal((current) => ({
      ...current,
      [submittedPortal]: result.ok
        ? {
            tone: 'ok',
            message: result.message ?? 'Registration submitted.',
          }
        : {
            tone: 'error',
            message: result.message ?? 'Registration failed. Please try again.',
          },
    }))

    // Registration signs the account in, so continue straight to its workspace.
    if (result.ok && result.user && result.role) {
      setUser(result.user)
      navigate(ROLE_HOME[result.role], { replace: true })
    }
  }

  return (
    <form
      className="auth-form"
      id="registration-form"
      ref={formRef}
      noValidate
      aria-busy={pending}
      onSubmit={handleSubmit}
    >
      <p className="eyebrow">Registration</p>
      <h1 id="signup-heading">{config.registrationHeading}</h1>
      <p className="auth-form__desc">{config.registrationDescription}</p>

      <div className="reg-grid" key={portal}>
        {config.fields.map((field, index) => {
          const id = `reg-${field.name}`
          const value = values[field.name] ?? ''
          const error = errors[field.name]
          const wide = index < 3

          if (field.type === 'select') {
            return (
              <SelectField
                key={field.name}
                id={id}
                name={field.name}
                label={field.label}
                value={value}
                options={field.options ?? []}
                placeholder={`Select ${field.label.toLowerCase()}`}
                error={error}
                wide={wide}
                onChange={(nextValue) => setField(field.name, nextValue)}
              />
            )
          }

          if (field.type === 'password') {
            return (
              <PasswordInput
                key={field.name}
                id={id}
                name={field.name}
                label={field.label}
                autoComplete={field.autoComplete}
                value={value}
                error={error}
                hint={
                  field.name === 'password' ? 'Use at least 8 characters.' : undefined
                }
                wide={wide}
                onChange={(nextValue) => setField(field.name, nextValue)}
              />
            )
          }

          return (
            <TextField
              key={field.name}
              id={id}
              name={field.name}
              label={field.label}
              type={field.type}
              autoComplete={field.autoComplete}
              value={value}
              error={error}
              wide={wide}
              onChange={(nextValue) => setField(field.name, nextValue)}
            />
          )
        })}
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
        {pending ? 'Creating account…' : config.submitLabel}
      </button>
    </form>
  )
}

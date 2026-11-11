import { useState } from 'react'
import { FieldShell } from './fields'

interface PasswordInputProps {
  id: string
  name: string
  label: string
  value: string
  autoComplete?: string
  error?: string
  hint?: string
  wide?: boolean
  onChange: (value: string) => void
}

export default function PasswordInput({
  id,
  name,
  label,
  value,
  autoComplete,
  error,
  hint,
  wide,
  onChange,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const describedBy = [
    hint && !error ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <FieldShell id={id} label={label} error={error} hint={hint} wide={wide}>
      <div className="password-field">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="password-toggle"
          aria-pressed={visible}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </FieldShell>
  )
}

import type { ReactNode } from 'react'

interface FieldShellProps {
  id: string
  label: string
  error?: string
  hint?: string
  wide?: boolean
  children: ReactNode
}

function describedBy(id: string, error?: string, hint?: string): string | undefined {
  const ids = [
    hint && !error ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ].filter(Boolean)

  return ids.length > 0 ? ids.join(' ') : undefined
}

export function FieldShell({ id, label, error, hint, wide, children }: FieldShellProps) {
  return (
    <div className={wide ? 'field field--wide' : 'field'}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error ? (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

interface TextFieldProps {
  id: string
  name: string
  label: string
  type: 'text' | 'email' | 'tel'
  value: string
  autoComplete?: string
  error?: string
  hint?: string
  wide?: boolean
  onChange: (value: string) => void
}

export function TextField({
  id,
  name,
  label,
  type,
  value,
  autoComplete,
  error,
  hint,
  wide,
  onChange,
}: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} wide={wide}>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  )
}

interface SelectFieldProps {
  id: string
  name: string
  label: string
  value: string
  options: readonly string[]
  placeholder: string
  error?: string
  wide?: boolean
  onChange: (value: string) => void
}

export function SelectField({
  id,
  name,
  label,
  value,
  options,
  placeholder,
  error,
  wide,
  onChange,
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} wide={wide}>
      <select
        id={id}
        name={name}
        value={value}
        className={value ? undefined : 'select--placeholder'}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error)}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

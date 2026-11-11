import type { AuthFieldConfig } from '../types/auth'

export type FieldErrors = Record<string, string>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
const PHONE_ALLOWED = /^\+?[0-9\s()-]+$/

export function validateEmail(value: string): string | undefined {
  const trimmed = value.trim()

  if (!trimmed) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address.'
  return undefined
}

export function validatePhone(value: string): string | undefined {
  const trimmed = value.trim()

  if (!trimmed) return 'Enter your phone number.'
  if (!PHONE_ALLOWED.test(trimmed)) {
    return 'Use digits, spaces, dashes or a leading + only.'
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) {
    return 'Enter a phone number with 8 to 15 digits.'
  }

  return undefined
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Enter a password.'
  if (value.length < 8) return 'Use at least 8 characters.'
  return undefined
}

export function validateLogin(values: { email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {}

  const emailError = validateEmail(values.email)
  if (emailError) errors.email = emailError
  if (!values.password) errors.password = 'Enter your password.'

  return errors
}

export function validateRegistration(
  fields: readonly AuthFieldConfig[],
  values: Record<string, string>,
): FieldErrors {
  const errors: FieldErrors = {}

  for (const field of fields) {
    const value = values[field.name] ?? ''

    if (field.type === 'select') {
      if (!value) errors[field.name] = `Select ${field.label.toLowerCase()}.`
      continue
    }

    if (field.type === 'email') {
      const message = validateEmail(value)
      if (message) errors[field.name] = message
      continue
    }

    if (field.type === 'tel') {
      const message = validatePhone(value)
      if (message) errors[field.name] = message
      continue
    }

    if (field.type === 'password') {
      if (field.name === 'confirmPassword' && !value) {
        errors[field.name] = 'Re-enter your password.'
      } else {
        const message = validatePassword(value)
        if (message) errors[field.name] = message
      }
      continue
    }

    if (!value.trim()) errors[field.name] = `Enter your ${field.label.toLowerCase()}.`
  }

  if (!errors.confirmPassword && values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}

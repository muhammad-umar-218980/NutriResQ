export type PortalId = 'donor' | 'recipient' | 'delivery'

export type Role = PortalId | 'admin'

export type AuthMode = 'login' | 'signup'

export type AuthFieldType = 'text' | 'email' | 'tel' | 'select' | 'password'

export interface AuthFieldConfig {
  name: string
  label: string
  type: AuthFieldType
  autoComplete?: string
  /** Present for select fields only. */
  options?: readonly string[]
}

export interface PortalConfig {
  id: PortalId
  label: string
  registrationHeading: string
  registrationDescription: string
  submitLabel: string
  fields: readonly AuthFieldConfig[]
}

export interface LoginPayload {
  portal: PortalId
  email: string
  password: string
  remember: boolean
}

export interface RegistrationPayload {
  portal: PortalId
  email: string
  phone: string
  password: string
  /** Portal-specific profile fields such as business name, type and representative. */
  profile: Record<string, string>
}

export interface ApiUser {
  id: string
  email: string
  phone: string | null
  role: Role
  status: 'active' | 'suspended'
  emailVerifiedAt: string | null
  createdAt: string
  profile: Record<string, string | null> | null
}

export interface AuthResult {
  ok: boolean
  message?: string
  /** True when there is no authentication endpoint behind the request yet. */
  unavailable?: boolean
  /**
   * The role the backend resolved for the account. It is never inferred from
   * the portal query parameter, which is only a UI hint.
   */
  role?: Role
  user?: ApiUser
  /** Dev-only verification link (email delivery is not configured yet). */
  verificationUrl?: string
}

export const ROLE_HOME: Record<Role, string> = {
  donor: '/donor',
  recipient: '/recipient',
  delivery: '/delivery',
  admin: '/admin',
}

export const ROLE_LABEL: Record<Role, string> = {
  donor: 'Food Donor',
  recipient: 'Food Recipient',
  delivery: 'Delivery Partner',
  admin: 'Administrator',
}

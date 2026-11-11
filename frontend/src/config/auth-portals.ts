import type { PortalConfig, PortalId } from '../types/auth'

export const PORTALS: Record<PortalId, PortalConfig> = {
  donor: {
    id: 'donor',
    label: 'Food Donor',
    registrationHeading: 'Create your donor account',
    registrationDescription: 'Start rescuing surplus food and connecting with organizations.',
    submitLabel: 'Create Donor Account',
    fields: [
      {
        name: 'businessName',
        label: 'Business Name',
        type: 'text',
        autoComplete: 'organization',
      },
      {
        name: 'businessType',
        label: 'Business Type',
        type: 'select',
        options: [
          'Restaurant',
          'Bakery',
          'Supermarket / Grocery Store',
          'Hotel',
          'Catering Business',
          'Food Manufacturer',
          'Other',
        ],
      },
      {
        name: 'representativeName',
        label: 'Representative Name',
        type: 'text',
        autoComplete: 'name',
      },
      {
        name: 'email',
        label: 'Business Email',
        type: 'email',
        autoComplete: 'email',
      },
      {
        name: 'phone',
        label: 'Phone Number',
        type: 'tel',
        autoComplete: 'tel',
      },
      {
        name: 'password',
        label: 'Password',
        type: 'password',
        autoComplete: 'new-password',
      },
      {
        name: 'confirmPassword',
        label: 'Confirm Password',
        type: 'password',
        autoComplete: 'new-password',
      },
    ],
  },

  recipient: {
    id: 'recipient',
    label: 'Food Recipient',
    registrationHeading: 'Register your organization',
    registrationDescription: 'Connect with food donors and receive surplus food.',
    submitLabel: 'Register Organization',
    fields: [
      {
        name: 'organizationName',
        label: 'Organization Name',
        type: 'text',
        autoComplete: 'organization',
      },
      {
        name: 'organizationType',
        label: 'Organization Type',
        type: 'select',
        options: [
          'NGO',
          'Welfare Organization',
          'Charity',
          'Community Kitchen',
          'Orphanage',
          'Shelter Home',
          'Other',
        ],
      },
      {
        name: 'representativeName',
        label: 'Representative Name',
        type: 'text',
        autoComplete: 'name',
      },
      {
        name: 'email',
        label: 'Official Email',
        type: 'email',
        autoComplete: 'email',
      },
      {
        name: 'phone',
        label: 'Phone Number',
        type: 'tel',
        autoComplete: 'tel',
      },
      {
        name: 'password',
        label: 'Password',
        type: 'password',
        autoComplete: 'new-password',
      },
      {
        name: 'confirmPassword',
        label: 'Confirm Password',
        type: 'password',
        autoComplete: 'new-password',
      },
    ],
  },

  delivery: {
    id: 'delivery',
    label: 'Delivery Partner',
    registrationHeading: 'Join our delivery network',
    registrationDescription: 'Help connect surplus food with those who need it.',
    submitLabel: 'Join as Delivery Partner',
    fields: [
      {
        name: 'companyName',
        label: 'Company / Fleet Name',
        type: 'text',
        autoComplete: 'organization',
      },
      {
        name: 'businessType',
        label: 'Business Type',
        type: 'select',
        options: [
          'Delivery Company',
          'Logistics Provider',
          'Independent Fleet Operator',
          'Other',
        ],
      },
      {
        name: 'fleetManagerName',
        label: 'Fleet Manager Name',
        type: 'text',
        autoComplete: 'name',
      },
      {
        name: 'email',
        label: 'Business Email',
        type: 'email',
        autoComplete: 'email',
      },
      {
        name: 'phone',
        label: 'Phone Number',
        type: 'tel',
        autoComplete: 'tel',
      },
      {
        name: 'password',
        label: 'Password',
        type: 'password',
        autoComplete: 'new-password',
      },
      {
        name: 'confirmPassword',
        label: 'Confirm Password',
        type: 'password',
        autoComplete: 'new-password',
      },
    ],
  },
}

export const PORTAL_ORDER: readonly PortalId[] = ['donor', 'recipient', 'delivery']

export function isPortalId(value: string | null): value is PortalId {
  return value === 'donor' || value === 'recipient' || value === 'delivery'
}

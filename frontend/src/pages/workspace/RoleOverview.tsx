import { useOutletContext } from 'react-router-dom'
import { Card, PageHeader } from '../../components/app/ui'
import { useAuth } from '../../auth/context'
import { ROLE_LABEL, type ApiUser, type PortalId } from '../../types/auth'

const PROFILE_FIELDS: Record<PortalId, Array<{ key: string; label: string }>> = {
  donor: [
    { key: 'businessName', label: 'Business name' },
    { key: 'businessType', label: 'Business type' },
    { key: 'representativeName', label: 'Representative' },
  ],
  recipient: [
    { key: 'organizationName', label: 'Organization name' },
    { key: 'organizationType', label: 'Organization type' },
    { key: 'representativeName', label: 'Representative' },
  ],
  delivery: [
    { key: 'companyName', label: 'Company / fleet' },
    { key: 'businessType', label: 'Business type' },
    { key: 'fleetManagerName', label: 'Fleet manager' },
  ],
}

interface RoleContext {
  user: ApiUser | null
}

/** Profile summary shared by the three portal overview screens. */
export function RoleOverview({ role }: { role: PortalId }) {
  const { user } = useOutletContext<RoleContext>()
  const fallback = useAuth().user

  const account = user ?? fallback
  const fields = PROFILE_FIELDS[role]

  return (
    <>
      <PageHeader
        eyebrow={ROLE_LABEL[role]}
        title={`Welcome, ${account?.profile?.[fields[0].key] ?? account?.email ?? 'there'}`}
        description={
          role === 'donor'
            ? 'List surplus food, track what has been collected and see how much reaches the community.'
            : role === 'recipient'
              ? 'See food that is available nearby and track what has been allocated to your organization.'
              : 'Manage your fleet and see the routes assigned to your vehicles.'
        }
      />

      {!account?.emailVerifiedAt ? (
        <div className="notice" role="status" style={{ marginBottom: 20 }}>
          <p>
            <strong>Your email address is not verified yet.</strong>
            Email delivery is not configured on this installation, so the
            verification link is written to the server log and can be requested
            again from your profile.
          </p>
        </div>
      ) : null}

      <div className="stat-grid">
        <div className="stat">
          <p className="stat__label">Account status</p>
          <p className="stat__value" style={{ fontSize: '1.3rem', textTransform: 'capitalize' }}>
            {account?.status ?? '—'}
          </p>
          <p className="stat__hint">{account?.email ?? ''}</p>
        </div>
        {fields.map((field) => (
          <div className="stat" key={field.key}>
            <p className="stat__label">{field.label}</p>
            <p className="stat__value" style={{ fontSize: '1.15rem', lineHeight: 1.3 }}>
              {account?.profile?.[field.key] ?? '—'}
            </p>
          </div>
        ))}
      </div>

      <Card title="Workspace data" description="Figures appear here once the operations schema is seeded.">
        <div className="state">
          <p>
            This workspace is connected to your verified account. Operational
            data such as donations, allocations and routes is loaded from the
            API and will appear here.
          </p>
        </div>
      </Card>
    </>
  )
}

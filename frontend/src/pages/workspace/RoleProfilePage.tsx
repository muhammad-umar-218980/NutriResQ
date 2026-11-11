import { Card, PageHeader } from '../../components/app/ui'
import { useAuth } from '../../auth/context'
import { ROLE_LABEL, type PortalId } from '../../types/auth'

const FIELDS: Record<PortalId, Array<{ key: string; label: string }>> = {
  donor: [
    { key: 'businessName', label: 'Business name' },
    { key: 'businessType', label: 'Business type' },
    { key: 'representativeName', label: 'Representative name' },
  ],
  recipient: [
    { key: 'organizationName', label: 'Organization name' },
    { key: 'organizationType', label: 'Organization type' },
    { key: 'representativeName', label: 'Representative name' },
  ],
  delivery: [
    { key: 'companyName', label: 'Company / fleet name' },
    { key: 'businessType', label: 'Business type' },
    { key: 'fleetManagerName', label: 'Fleet manager name' },
  ],
}

export default function RoleProfilePage({ role }: { role: PortalId }) {
  const { user } = useAuth()

  return (
    <>
      <PageHeader
        eyebrow={ROLE_LABEL[role]}
        title="Account profile"
        description="These details identify your organization to donors, recipients and administrators."
      />

      <Card title="Registration details">
        <dl className="profile-list">
          {FIELDS[role].map((field) => (
            <div key={field.key}>
              <dt>{field.label}</dt>
              <dd>{user?.profile?.[field.key] ?? '—'}</dd>
            </div>
          ))}
          <div>
            <dt>Email address</dt>
            <dd>{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt>Phone number</dt>
            <dd>{user?.phone ?? '—'}</dd>
          </div>
          <div>
            <dt>Email verified</dt>
            <dd>{user?.emailVerifiedAt ? 'Yes' : 'Not yet'}</dd>
          </div>
        </dl>
      </Card>
    </>
  )
}

import { useState } from 'react'
import { useApi, useDebounced } from '../../hooks/useApi'
import { apiRequest } from '../../lib/api'
import { ErrorState, LoadingRows, PageHeader, Pagination } from '../../components/app/ui'
import { formatDateTime } from '../../lib/format'
import type { ApiUser, PortalId } from '../../types/auth'

const ROLE_CONFIG: Record<
  PortalId,
  {
    heading: string
    description: string
    nameKey: 'businessName' | 'organizationName' | 'companyName'
    typeKey: 'businessType' | 'organizationType'
    contactKey: 'representativeName' | 'fleetManagerName'
  }
> = {
  donor: {
    heading: 'Food Donors',
    description:
      'Businesses that list surplus food. Suspending an account revokes its sessions immediately.',
    nameKey: 'businessName',
    typeKey: 'businessType',
    contactKey: 'representativeName',
  },
  recipient: {
    heading: 'Food Recipients',
    description:
      'Organizations that receive rescued food. Suspending an account revokes its sessions immediately.',
    nameKey: 'organizationName',
    typeKey: 'organizationType',
    contactKey: 'representativeName',
  },
  delivery: {
    heading: 'Delivery Partners',
    description:
      'Fleets that move food between donors and recipients. Suspending an account revokes its sessions immediately.',
    nameKey: 'companyName',
    typeKey: 'businessType',
    contactKey: 'fleetManagerName',
  },
}

interface UsersResponse {
  success: boolean
  users: ApiUser[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

export default function AdminUsersPage({ role }: { role: PortalId }) {
  const config = ROLE_CONFIG[role]

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | 'active' | 'suspended'>('')
  const [page, setPage] = useState(1)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const debouncedSearch = useDebounced(search, 250)
  const params = new URLSearchParams({
    role,
    page: String(page),
    pageSize: String(PAGE_SIZE),
  })
  if (status) params.set('status', status)
  if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim())

  const { data, error, loading, reload } = useApi<UsersResponse>(`/api/admin/users?${params.toString()}`)

  async function changeStatus(user: ApiUser, next: 'active' | 'suspended') {
    setPendingId(user.id)
    setActionError(null)

    try {
      await apiRequest(`/api/admin/users/${user.id}/status`, {
        method: 'PATCH',
        body: { status: next },
      })
      setConfirmingId(null)
      reload()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The account could not be updated.')
    } finally {
      setPendingId(null)
    }
  }

  const users = data?.users ?? []
  const total = data?.total ?? 0

  return (
    <>
      <PageHeader
        eyebrow="Account management"
        title={config.heading}
        description={config.description}
      />

      {actionError ? (
        <div className="notice" role="alert" style={{ marginBottom: 16 }}>
          <p>{actionError}</p>
        </div>
      ) : null}

      <section className="card">
        <div className="toolbar">
          <div className="toolbar__search">
            <label className="visually-hidden" htmlFor="account-search">
              Search {config.heading}
            </label>
            <input
              id="account-search"
              type="search"
              value={search}
              placeholder="Search name, email or phone"
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </div>

          <label className="visually-hidden" htmlFor="account-status">
            Filter by status
          </label>
          <select
            id="account-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as '' | 'active' | 'suspended')
              setPage(1)
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>

          <span className="toolbar__count" aria-live="polite">
            {loading ? 'Loading…' : `${total} account${total === 1 ? '' : 's'}`}
          </span>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingRows label={`Loading ${config.heading.toLowerCase()}…`} />
        ) : users.length === 0 ? (
          <div className="state">
            <h2>No matching accounts</h2>
            <p>
              {debouncedSearch || status
                ? 'Try a different search term or clear the status filter.'
                : `No ${config.heading.toLowerCase()} have registered yet.`}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption>
                {config.heading} registered in NutriResQ. Names come from each account's profile.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Email status</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="data-table__actions">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const name = user.profile?.[config.nameKey] ?? null
                  const type = user.profile?.[config.typeKey] ?? null
                  const contact = user.profile?.[config.contactKey] ?? null
                  const isConfirming = confirmingId === user.id
                  const isPending = pendingId === user.id

                  return (
                    <tr key={user.id}>
                      <td>
                        <span className="data-table__name">{name ?? 'Profile incomplete'}</span>
                        <span className="data-table__sub">
                          {type ?? '—'} · {user.email}
                        </span>
                      </td>
                      <td>
                        {contact ?? '—'}
                        <span className="data-table__sub">{user.phone ?? 'No phone'}</span>
                      </td>
                      <td>
                        {user.emailVerifiedAt ? (
                          <span className="pill pill--neutral">Verified</span>
                        ) : (
                          <span className="pill pill--warning">Unverified</span>
                        )}
                      </td>
                      <td>{formatDateTime(user.createdAt)}</td>
                      <td>
                        <span className={`pill pill--${user.status}`}>
                          {user.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="data-table__actions">
                        {isConfirming ? (
                          <>
                            <button
                              type="button"
                              className="btn-danger btn-secondary--small"
                              disabled={isPending}
                              onClick={() =>
                                void changeStatus(
                                  user,
                                  user.status === 'active' ? 'suspended' : 'active',
                                )
                              }
                            >
                              {isPending
                                ? 'Saving…'
                                : user.status === 'active'
                                  ? 'Confirm suspend'
                                  : 'Confirm activate'}
                            </button>{' '}
                            <button
                              type="button"
                              className="btn-quiet"
                              disabled={isPending}
                              onClick={() => setConfirmingId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={user.status === 'active' ? 'btn-danger btn-secondary--small' : 'btn-secondary btn-secondary--small'}
                            onClick={() => setConfirmingId(user.id)}
                          >
                            {user.status === 'active' ? 'Suspend' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
          </div>
        )}
      </section>
    </>
  )
}

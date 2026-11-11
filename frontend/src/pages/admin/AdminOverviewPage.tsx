import { Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, ErrorState, LoadingRows, PageHeader, StatCard } from '../../components/app/ui'
import { formatDateTime } from '../../lib/format'
import type { ApiUser } from '../../types/auth'
import type { RunsResponse, ScenariosResponse } from '../../types/domain'
import './AdminWorkspace.css'

interface StatsResponse {
  success: boolean
  data: {
    byRole: Partial<
      Record<
        'donor' | 'recipient' | 'delivery' | 'admin',
        { total: number; active: number; suspended: number; unverified: number }
      >
    >
    totals: { users: number; active: number; suspended: number; unverified: number }
    generatedAt: string
  }
}

interface UsersResponse {
  success: boolean
  users: ApiUser[]
  total: number
}

function accountName(user: ApiUser): string {
  if (!user.profile) return '—'
  return (
    user.profile.businessName ??
    user.profile.organizationName ??
    user.profile.companyName ??
    '—'
  )
}

export default function AdminOverviewPage() {
  const stats = useApi<StatsResponse>('/api/admin/stats')
  const recent = useApi<UsersResponse>('/api/admin/users?pageSize=6')
  const scenarios = useApi<ScenariosResponse>('/api/scenarios')

  const scenario = scenarios.data?.scenarios[0] ?? null
  const runs = useApi<RunsResponse>(
    scenario ? `/api/scenarios/${encodeURIComponent(scenario.id)}/runs?page=1&pageSize=1` : null,
  )
  const latestRun = runs.data?.runs[0] ?? null

  const data = stats.data?.data
  const byRole = data?.byRole

  return (
    <>
      <PageHeader
        eyebrow="Admin workspace"
        title="Network overview"
        description="Live account counts from the database. Every figure on this page is served by the API; nothing is hard-coded."
      />

      <Card
        title="Algorithm workspace"
        description="Run the exact A*, multiple-knapsack DP, divide-and-conquer closest pair and ACO pipeline against the stored scenario, then inspect each algorithm against its labelled baseline."
        actions={
          <Link className="btn-primary btn-secondary--small" to="/admin/workspace">
            Open workspace
          </Link>
        }
      >
        {scenarios.error ? (
          <ErrorState message={scenarios.error} onRetry={scenarios.reload} />
        ) : scenarios.loading && !scenarios.data ? (
          <LoadingRows label="Loading scenario facts…" />
        ) : !scenario ? (
          <div className="state">
            <p>No scenario is stored. Seed the database before running the optimizer.</p>
          </div>
        ) : (
          <>
            <div className="scenario-facts">
              <span>
                <strong>{scenario.counts.locations}</strong> locations
              </span>
              <span>
                <strong>{scenario.counts.roads}</strong> roads
              </span>
              <span>
                <strong>{scenario.counts.donations}</strong> donations
              </span>
              <span>
                <strong>{scenario.counts.vehicles}</strong> vehicles
              </span>
              <span>
                <strong>{scenario.counts.runs}</strong> stored runs
              </span>
            </div>

            {runs.error ? (
              <p className="metric-note">{runs.error}</p>
            ) : runs.loading && !runs.data ? (
              <p className="metric-note">Loading the latest run…</p>
            ) : latestRun ? (
              <>
                <div className="run-meta">
                  <span>
                    Latest run: <strong>{formatDateTime(latestRun.startedAt)}</strong>
                  </span>
                  <span>
                    Status: <strong>{latestRun.status}</strong>
                  </span>
                  <span>
                    Allocated weight:{' '}
                    <strong>
                      {latestRun.metrics
                        ? `${latestRun.metrics.allocatedPackageWeightUnits} kg`
                        : '—'}
                    </strong>
                  </span>
                  <span>
                    Unallocated:{' '}
                    <strong>
                      {latestRun.metrics ? latestRun.metrics.unallocatedPackageCount : '—'}
                    </strong>
                  </span>
                  <span>
                    Road cost:{' '}
                    <strong>
                      {latestRun.metrics
                        ? `${latestRun.metrics.totalRoadCost} ${latestRun.metrics.totalRoadCostUnit}`
                        : '—'}
                    </strong>
                  </span>
                  <span>
                    Runtime:{' '}
                    <strong>
                      {latestRun.metrics ? `${latestRun.metrics.runtimeMs} ms` : '—'}
                    </strong>
                  </span>
                </div>
                <p className="metric-note">
                  Stored results are read from <code>result_json</code>. ACO is a heuristic; the
                  closest pair is straight-line projected distance, not road distance.
                </p>
              </>
            ) : (
              <p className="metric-note">
                No optimization run has been recorded for this scenario yet.
              </p>
            )}

            <div className="opt-form__actions">
              <Link className="btn-secondary btn-secondary--small" to="/admin/algorithms">
                Evaluate one algorithm
              </Link>
              <Link className="btn-secondary btn-secondary--small" to="/admin/benchmarks">
                Benchmark history
              </Link>
            </div>
          </>
        )}
      </Card>

      {stats.error ? (
        <Card>
          <ErrorState message={stats.error} onRetry={stats.reload} />
        </Card>
      ) : stats.loading && !data ? (
        <Card>
          <LoadingRows label="Loading account counts…" />
        </Card>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard
              label="Food Donors"
              value={byRole?.donor?.total ?? 0}
              hint={`${byRole?.donor?.active ?? 0} active · ${byRole?.donor?.suspended ?? 0} suspended`}
            />
            <StatCard
              label="Food Recipients"
              value={byRole?.recipient?.total ?? 0}
              hint={`${byRole?.recipient?.active ?? 0} active · ${byRole?.recipient?.suspended ?? 0} suspended`}
            />
            <StatCard
              label="Delivery Partners"
              value={byRole?.delivery?.total ?? 0}
              hint={`${byRole?.delivery?.active ?? 0} active · ${byRole?.delivery?.suspended ?? 0} suspended`}
            />
            <StatCard
              label="Total accounts"
              value={data?.totals.users ?? 0}
              hint={`${data?.totals.unverified ?? 0} unverified ${
                (data?.totals.unverified ?? 0) === 1 ? 'email address' : 'email addresses'
              }`}
            />
          </div>

          <Card
            title="Accounts by role"
            description="Suspended accounts keep their data but cannot sign in."
            actions={
              <Link className="btn-secondary btn-secondary--small" to="/admin/donors">
                Manage accounts
              </Link>
            }
          >
            <div className="table-wrap">
              <table className="data-table">
                <caption>Account counts grouped by portal role</caption>
                <thead>
                  <tr>
                    <th scope="col">Role</th>
                    <th scope="col">Total</th>
                    <th scope="col">Active</th>
                    <th scope="col">Suspended</th>
                    <th scope="col">Unverified</th>
                  </tr>
                </thead>
                <tbody>
                  {(['donor', 'recipient', 'delivery', 'admin'] as const).map((role) => (
                    <tr key={role}>
                      <th scope="row">
                        {role === 'donor'
                          ? 'Food Donor'
                          : role === 'recipient'
                            ? 'Food Recipient'
                            : role === 'delivery'
                              ? 'Delivery Partner'
                              : 'Administrator'}
                      </th>
                      <td>{byRole?.[role]?.total ?? 0}</td>
                      <td>{byRole?.[role]?.active ?? 0}</td>
                      <td>{byRole?.[role]?.suspended ?? 0}</td>
                      <td>{byRole?.[role]?.unverified ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ height: 22 }} />

          <Card
            title="Newest accounts"
            description="The six most recently created accounts across all portals."
          >
            {recent.error ? (
              <ErrorState message={recent.error} onRetry={recent.reload} />
            ) : recent.loading && !recent.data ? (
              <LoadingRows label="Loading recent accounts…" />
            ) : recent.data && recent.data.users.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <caption>Most recent registrations</caption>
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col">Role</th>
                      <th scope="col">Joined</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.data.users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <span className="data-table__name">{accountName(user)}</span>
                          <span className="data-table__sub">{user.email}</span>
                        </td>
                        <td>{user.role}</td>
                        <td>{formatDateTime(user.createdAt)}</td>
                        <td>
                          <span className={`pill pill--${user.status}`}>
                            {user.status === 'active' ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="state">
                <p>No accounts have registered yet.</p>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  )
}

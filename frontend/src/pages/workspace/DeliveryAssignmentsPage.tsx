import { Card, ErrorState, LoadingRows, PageHeader, Pagination } from '../../components/app/ui'
import { useApi } from '../../hooks/useApi'
import { formatDateTime } from '../../lib/format'
import type { DeliveryWorkspaceResponse } from '../../types/portal'
import './PortalWorkspace.css'

const PAGE_SIZE = 20

export default function DeliveryAssignmentsPage() {
  const { data, error, loading, reload } = useApi<DeliveryWorkspaceResponse>(
    '/api/portal/delivery',
  )

  const workspace = data?.workspace ?? null
  const assignments = workspace?.assignments ?? []
  const pageSize = PAGE_SIZE
  const total = assignments.length
  const page = 1
  const from = total === 0 ? 0 : 1
  const to = Math.min(total, pageSize)

  return (
    <>
      <PageHeader
        eyebrow="Delivery Partner"
        title="Assignments"
        description="Routes assigned to your vehicles by stored optimization runs. Figures come from each run’s result — nothing is recomputed here."
      />

      {error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : loading && !workspace ? (
        <Card>
          <LoadingRows label="Loading your assignments…" />
        </Card>
      ) : !workspace ? (
        <Card>
          <ErrorState message="Your assignments could not be loaded." onRetry={reload} />
        </Card>
      ) : (
        <>
          <Card
            title="Assignment history"
            description={`Showing ${from}–${to} of ${total} route assignments.`}
          >
            <div className="portal-facts">
              <span>
                Routes: <strong>{total}</strong>
              </span>
              <span>
                Complete:{' '}
                <strong>
                  {assignments.filter((assignment) => assignment.routeStatus === 'complete')
                    .length}
                </strong>
              </span>
              <span>
                Total road cost:{' '}
                <strong>
                  {assignments
                    .reduce((sum, assignment) => sum + assignment.totalCost, 0)
                    .toFixed(2)}{' '}
                  km
                </strong>
              </span>
            </div>
          </Card>

          <Card
            title="Routes assigned to your vehicles"
            description="Each row is one vehicle route from a stored run. Stop order comes from the ACO route ordering measured at run time."
          >
            {assignments.length === 0 ? (
              <p className="portal-empty">
                No routes have been assigned to your vehicles yet. Run the optimizer from the admin
                workspace to record assignments.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <caption>
                    Assignment rows from stored runs for this delivery partner&rsquo;s vehicles.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Vehicle</th>
                      <th scope="col">Run</th>
                      <th scope="col">Started</th>
                      <th scope="col">Status</th>
                      <th scope="col">Road cost</th>
                      <th scope="col">Stops</th>
                      <th scope="col">Infeasible reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.slice(from - 1, to).map((assignment) => (
                      <tr key={assignment.routeId}>
                        <th scope="row">{assignment.vehicleName ?? 'Unnamed vehicle'}</th>
                        <td>{assignment.runId.slice(0, 8)}</td>
                        <td>{formatDateTime(assignment.startedAt)}</td>
                        <td>
                          <span
                            className={`status-badge ${
                              assignment.routeStatus === 'complete'
                                ? 'status-badge--available'
                                : 'status-badge--unavailable'
                            }`}
                          >
                            {assignment.routeStatus}
                          </span>
                        </td>
                        <td>
                          {assignment.totalCost.toFixed(2)}{' '}
                          <span style={{ color: 'var(--muted)' }}>{assignment.costUnit}</span>
                        </td>
                        <td>{assignment.stopCount}</td>
                        <td>
                          {assignment.infeasibleReason ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {assignments.length > pageSize ? (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPage={() => {}}
              />
            ) : null}
          </Card>
        </>
      )}
    </>
  )
}

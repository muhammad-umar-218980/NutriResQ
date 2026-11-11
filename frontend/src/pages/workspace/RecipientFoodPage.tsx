import { useState, type FormEvent } from 'react'
import { Card, ErrorState, LoadingRows, PageHeader } from '../../components/app/ui'
import { useApi } from '../../hooks/useApi'
import { fieldErrorsFrom } from '../../lib/api'
import { updateRecipientProfile } from '../../lib/portal-api'
import { formatDateTime } from '../../lib/format'
import type { RecipientBody, RecipientWorkspaceResponse } from '../../types/portal'
import './PortalWorkspace.css'

export default function RecipientFoodPage() {
  const { data, error, loading, reload } = useApi<RecipientWorkspaceResponse>(
    '/api/portal/recipient',
  )

  const workspace = data?.workspace ?? null
  const donations = workspace?.donations ?? []

  return (
    <>
      <PageHeader
        eyebrow="Food Recipient"
        title="Food available to you"
        description="Packages a donor addressed to your organization, plus the demand and priority the optimizer uses when it allocates unreserved surplus."
      />

      {error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : loading && !workspace ? (
        <Card>
          <LoadingRows label="Loading your allocation data…" />
        </Card>
      ) : !workspace ? (
        <Card>
          <div className="state">
            <h2>No recipient record is linked to this account</h2>
            <p>Ask an administrator to link your account to a food-recipient record.</p>
          </div>
        </Card>
      ) : (
        <>
          <Card
            title={workspace.recipient.name}
            description={`${workspace.recipient.locationName}${
              workspace.recipient.isAvailable ? ' · accepting food' : ' · not accepting food'
            }`}
          >
            <p className="portal-facts">
              <span>
                Type: <strong>{workspace.recipient.recipientType ?? 'not set'}</strong>
              </span>
              <span>
                Demand: <strong>{workspace.recipient.demandUnits} kg</strong>
              </span>
              <span>
                Priority: <strong>{workspace.recipient.priorityScore}</strong>
              </span>
              <span>
                Packages addressed to you: <strong>{donations.length}</strong>
              </span>
            </p>
          </Card>

          <Card
            title="Request profile"
            description="Demand is whole kilograms. Priority is 0–100 and multiplies a package's value score when the multiple-knapsack DP allocates food."
          >
            <RecipientForm
              key={`${workspace.recipient.demandUnits}-${workspace.recipient.priorityScore}-${workspace.recipient.isAvailable}`}
              recipient={workspace.recipient}
              onSaved={reload}
            />
          </Card>

          <Card
            title="Packages addressed to your organization"
            description="Only donations with your organization as the intended recipient appear here. Untargeted surplus is matched by the optimizer and is not reserved for anyone."
          >
            {donations.length === 0 ? (
              <p className="portal-empty">
                No donor has addressed a package to your organization yet. Untargeted surplus is
                still matched to you when you are the best fit in a run.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <caption>Donations whose intended recipient is {workspace.recipient.name}.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Package</th>
                      <th scope="col">Donor</th>
                      <th scope="col">Weight</th>
                      <th scope="col">Value</th>
                      <th scope="col">Available from</th>
                      <th scope="col">Expires</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donations.map((donation) => (
                      <tr key={donation.id}>
                        <th scope="row">
                          <span className="data-table__name">{donation.packageName}</span>
                          <span className="data-table__sub">
                            {donation.isEligible ? 'Eligible' : 'Ineligible for optimization'}
                          </span>
                        </th>
                        <td>{donation.donorName}</td>
                        <td>{donation.weightUnits} kg</td>
                        <td>{donation.valueScore}</td>
                        <td>
                          {donation.availableAt ? formatDateTime(donation.availableAt) : 'Immediately'}
                        </td>
                        <td>{donation.expiresAt ? formatDateTime(donation.expiresAt) : 'No expiry'}</td>
                        <td>
                          <span className={`status-badge status-badge--${donation.status}`}>
                            {donation.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  )
}

function RecipientForm({
  recipient,
  onSaved,
}: {
  recipient: NonNullable<RecipientWorkspaceResponse['workspace']>['recipient']
  onSaved: () => void
}) {
  const [recipientType, setRecipientType] = useState(recipient.recipientType ?? '')
  const [demandUnits, setDemandUnits] = useState(String(recipient.demandUnits))
  const [priorityScore, setPriorityScore] = useState(String(recipient.priorityScore))
  const [isAvailable, setIsAvailable] = useState(recipient.isAvailable)

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [savedAt, setSavedAt] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setFieldErrors({})
    setSavedAt(null)

    const demand = Number(demandUnits)
    const priority = Number(priorityScore)

    if (!Number.isInteger(demand) || demand < 0) {
      setFieldErrors({ demandUnits: 'Enter a whole number of kilograms, zero or more.' })
      return
    }
    if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
      setFieldErrors({ priorityScore: 'Enter a whole number between 0 and 100.' })
      return
    }

    const body: RecipientBody = {
      recipientType: recipientType.trim() ? recipientType.trim() : null,
      demandUnits: demand,
      priorityScore: priority,
      isAvailable,
    }

    setSaving(true)
    try {
      await updateRecipientProfile(body)
      setSavedAt(new Date().toISOString())
      onSaved()
    } catch (cause) {
      setFieldErrors(fieldErrorsFrom(cause))
      setFormError(
        cause instanceof Error ? cause.message : 'The request profile could not be saved.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="portal-form" onSubmit={handleSubmit} noValidate>
      {formError ? (
        <p className="notice notice--error" role="alert">
          {formError}
        </p>
      ) : null}
      {savedAt ? (
        <p className="notice" role="status">
          Saved. New values apply to the next optimization run.
        </p>
      ) : null}

      <div className="portal-form__grid">
        <div className="portal-field">
          <label htmlFor="recipient-type">Organization type</label>
          <input
            id="recipient-type"
            type="text"
            maxLength={60}
            value={recipientType}
            placeholder="community_kitchen"
            onChange={(event) => setRecipientType(event.target.value)}
          />
          {fieldErrors.recipientType ? (
            <p className="portal-field__error">{fieldErrors.recipientType}</p>
          ) : null}
        </div>

        <div className="portal-field">
          <label htmlFor="recipient-demand">Demand (kg)</label>
          <input
            id="recipient-demand"
            type="number"
            min={0}
            step={1}
            value={demandUnits}
            onChange={(event) => setDemandUnits(event.target.value)}
          />
          {fieldErrors.demandUnits ? (
            <p className="portal-field__error">{fieldErrors.demandUnits}</p>
          ) : (
            <p className="portal-field__hint">How much food you can accept in one run.</p>
          )}
        </div>

        <div className="portal-field">
          <label htmlFor="recipient-priority">Priority (0–100)</label>
          <input
            id="recipient-priority"
            type="number"
            min={0}
            max={100}
            step={1}
            value={priorityScore}
            onChange={(event) => setPriorityScore(event.target.value)}
          />
          {fieldErrors.priorityScore ? (
            <p className="portal-field__error">{fieldErrors.priorityScore}</p>
          ) : (
            <p className="portal-field__hint">Higher priority increases the DP objective value.</p>
          )}
        </div>

        <div className="portal-field">
          <span className="portal-field__label">Availability</span>
          <div className="portal-field--check">
            <input
              id="recipient-available"
              type="checkbox"
              checked={isAvailable}
              onChange={(event) => setIsAvailable(event.target.checked)}
            />
            <label htmlFor="recipient-available">Accept new food in the next run</label>
          </div>
        </div>
      </div>

      <div className="portal-form__actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save request profile'}
        </button>
      </div>
    </form>
  )
}

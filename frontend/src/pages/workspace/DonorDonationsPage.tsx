import { useState, type FormEvent } from 'react'
import { Card, ErrorState, LoadingRows, PageHeader } from '../../components/app/ui'
import { useApi } from '../../hooks/useApi'
import { fieldErrorsFrom } from '../../lib/api'
import { createDonation, deleteDonation, updateDonation } from '../../lib/portal-api'
import { formatDateTime } from '../../lib/format'
import type {
  DonationBody,
  DonationStatus,
  DonorWorkspaceResponse,
  PortalDonation,
} from '../../types/portal'
import './PortalWorkspace.css'

const STATUS_OPTIONS: Array<{ value: DonationStatus; label: string }> = [
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'expired', label: 'Expired' },
]

/** Formats an ISO timestamp for a `datetime-local` input in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

/** Converts a `datetime-local` value back to an ISO instant, or null if empty. */
function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export default function DonorDonationsPage() {
  const { data, error, loading, reload } = useApi<DonorWorkspaceResponse>('/api/portal/donor')

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const workspace = data?.workspace ?? null
  const donations = workspace?.donations ?? []
  const editing = editingId ? (donations.find((item) => item.id === editingId) ?? null) : null

  function openCreate() {
    setEditingId(null)
    setFormOpen(true)
    setActionError(null)
  }

  function openEdit(donation: PortalDonation) {
    setEditingId(donation.id)
    setFormOpen(true)
    setActionError(null)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
  }

  function afterSave() {
    closeForm()
    reload()
  }

  async function removeDonation(donation: PortalDonation) {
    setPendingId(donation.id)
    setActionError(null)
    try {
      await deleteDonation(donation.id)
      setConfirmingId(null)
      reload()
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'The package could not be deleted.',
      )
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Food Donor"
        title="My donations"
        description="List surplus packages, set an intended recipient and keep expiry honest. The optimizer only ever uses what is stored here."
      />

      {actionError ? (
        <div className="notice notice--error" role="alert">
          <p>{actionError}</p>
        </div>
      ) : null}

      {error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : loading && !workspace ? (
        <Card>
          <LoadingRows label="Loading your donations…" />
        </Card>
      ) : !workspace ? (
        <Card>
          <div className="state">
            <h2>No donor record is linked to this account</h2>
            <p>Ask an administrator to link your account to a food-donor record.</p>
          </div>
        </Card>
      ) : (
        <>
          <Card
            title={workspace.donor.name}
            description={`${workspace.donor.locationName}${
              workspace.donor.donorType ? ` · ${workspace.donor.donorType}` : ''
            } · ${workspace.donor.isActive ? 'active' : 'inactive'}`}
            actions={
              formOpen ? null : (
                <button type="button" className="btn-primary btn-secondary--small" onClick={openCreate}>
                  Add a package
                </button>
              )
            }
          >
            <p className="portal-facts">
              <span>
                Packages on file: <strong>{donations.length}</strong>
              </span>
              <span>
                Available:{' '}
                <strong>
                  {donations.filter((item) => item.status === 'available').length}
                </strong>
              </span>
              <span>
                Total weight:{' '}
                <strong>
                  {donations
                    .filter((item) => item.status === 'available' && item.isEligible)
                    .reduce((sum, item) => sum + item.weightUnits, 0)}{' '}
                  kg
                </strong>
              </span>
            </p>
          </Card>

          {formOpen ? (
            <Card
              title={editing ? `Edit ${editing.packageName}` : 'List a new package'}
              description="Weight is whole kilograms and the value score is 0–100. Expiry is evaluated against the moment a run starts."
            >
              <DonationForm
                key={editing?.id ?? 'new'}
                donation={editing}
                recipients={workspace.recipients}
                onSaved={afterSave}
                onCancel={closeForm}
              />
            </Card>
          ) : null}

          <Card
            title="Listed packages"
            description="Only your own packages are shown. Expired and ineligible packages stay listed rather than disappearing."
          >
            {donations.length === 0 ? (
              <p className="portal-empty">
                You have not listed any packages yet. Use “Add a package” to create the first one.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <caption>Packages listed by {workspace.donor.name}.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Package</th>
                      <th scope="col">Weight</th>
                      <th scope="col">Value</th>
                      <th scope="col">Intended recipient</th>
                      <th scope="col">Available from</th>
                      <th scope="col">Expires</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="data-table__actions">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {donations.map((donation) => {
                      const busy = pendingId === donation.id
                      return (
                        <tr key={donation.id}>
                          <th scope="row">
                            <span className="data-table__name">{donation.packageName}</span>
                            <span className="data-table__sub">
                              {donation.isEligible ? 'Eligible' : 'Ineligible for optimization'}
                            </span>
                          </th>
                          <td>{donation.weightUnits} kg</td>
                          <td>{donation.valueScore}</td>
                          <td>{donation.recipientName ?? 'Any recipient'}</td>
                          <td>
                            {donation.availableAt ? formatDateTime(donation.availableAt) : 'Immediately'}
                          </td>
                          <td>{donation.expiresAt ? formatDateTime(donation.expiresAt) : 'No expiry'}</td>
                          <td>
                            <span className={`status-badge status-badge--${donation.status}`}>
                              {donation.status}
                            </span>
                          </td>
                          <td className="data-table__actions">
                            {confirmingId === donation.id ? (
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="btn-danger"
                                  disabled={busy}
                                  onClick={() => void removeDonation(donation)}
                                >
                                  {busy ? 'Deleting…' : 'Confirm delete'}
                                </button>
                                <button
                                  type="button"
                                  className="btn-quiet"
                                  disabled={busy}
                                  onClick={() => setConfirmingId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="btn-quiet"
                                  onClick={() => openEdit(donation)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn-quiet"
                                  onClick={() => setConfirmingId(donation.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
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

function DonationForm({
  donation,
  recipients,
  onSaved,
  onCancel,
}: {
  donation: PortalDonation | null
  recipients: Array<{ id: string; name: string }>
  onSaved: () => void
  onCancel: () => void
}) {
  const [packageName, setPackageName] = useState(donation?.packageName ?? '')
  const [weightUnits, setWeightUnits] = useState(String(donation?.weightUnits ?? 10))
  const [valueScore, setValueScore] = useState(String(donation?.valueScore ?? 50))
  const [recipientId, setRecipientId] = useState(donation?.recipientId ?? '')
  const [availableAt, setAvailableAt] = useState(toLocalInput(donation?.availableAt ?? null))
  const [expiresAt, setExpiresAt] = useState(toLocalInput(donation?.expiresAt ?? null))
  const [isEligible, setIsEligible] = useState(donation?.isEligible ?? true)
  const [status, setStatus] = useState<DonationStatus>(donation?.status ?? 'available')

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setFieldErrors({})

    const weight = Number(weightUnits)
    const value = Number(valueScore)

    if (!Number.isInteger(weight) || weight <= 0) {
      setFieldErrors({ weightUnits: 'Enter a whole number of kilograms, at least 1.' })
      return
    }
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      setFieldErrors({ valueScore: 'Enter a whole number between 0 and 100.' })
      return
    }

    const body: DonationBody = {
      packageName: packageName.trim(),
      weightUnits: weight,
      valueScore: value,
      recipientId: recipientId || null,
      availableAt: fromLocalInput(availableAt),
      expiresAt: fromLocalInput(expiresAt),
      isEligible,
      status,
    }

    setSaving(true)
    try {
      if (donation) {
        await updateDonation(donation.id, body)
      } else {
        await createDonation(body)
      }
      onSaved()
    } catch (cause) {
      setFieldErrors(fieldErrorsFrom(cause))
      setFormError(
        cause instanceof Error ? cause.message : 'The package could not be saved.',
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

      <div className="portal-form__grid">
        <div className="portal-field">
          <label htmlFor="donation-name">Package name</label>
          <input
            id="donation-name"
            type="text"
            value={packageName}
            maxLength={120}
            required
            onChange={(event) => setPackageName(event.target.value)}
          />
          {fieldErrors.packageName ? (
            <p className="portal-field__error">{fieldErrors.packageName}</p>
          ) : null}
        </div>

        <div className="portal-field">
          <label htmlFor="donation-weight">Weight (kg)</label>
          <input
            id="donation-weight"
            type="number"
            min={1}
            step={1}
            value={weightUnits}
            required
            onChange={(event) => setWeightUnits(event.target.value)}
          />
          {fieldErrors.weightUnits ? (
            <p className="portal-field__error">{fieldErrors.weightUnits}</p>
          ) : (
            <p className="portal-field__hint">Whole kilograms only; packages are indivisible.</p>
          )}
        </div>

        <div className="portal-field">
          <label htmlFor="donation-value">Value score (0–100)</label>
          <input
            id="donation-value"
            type="number"
            min={0}
            max={100}
            step={1}
            value={valueScore}
            required
            onChange={(event) => setValueScore(event.target.value)}
          />
          {fieldErrors.valueScore ? (
            <p className="portal-field__error">{fieldErrors.valueScore}</p>
          ) : (
            <p className="portal-field__hint">
              The optimizer multiplies this by the recipient&apos;s priority.
            </p>
          )}
        </div>

        <div className="portal-field">
          <label htmlFor="donation-recipient">Intended recipient</label>
          <select
            id="donation-recipient"
            value={recipientId}
            onChange={(event) => setRecipientId(event.target.value)}
          >
            <option value="">Any recipient</option>
            {recipients.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          <p className="portal-field__hint">
            Leave as “Any recipient” to let the optimizer choose from the whole scenario.
          </p>
        </div>

        <div className="portal-field">
          <label htmlFor="donation-available">Available from</label>
          <input
            id="donation-available"
            type="datetime-local"
            value={availableAt}
            onChange={(event) => setAvailableAt(event.target.value)}
          />
          <p className="portal-field__hint">Leave empty when the food is ready now.</p>
        </div>

        <div className="portal-field">
          <label htmlFor="donation-expires">Expires at</label>
          <input
            id="donation-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
          <p className="portal-field__hint">
            A package is expired when this time is at or before the run start.
          </p>
        </div>

        <div className="portal-field">
          <label htmlFor="donation-status">Status</label>
          <select
            id="donation-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as DonationStatus)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="portal-field">
          <span className="portal-field__label">Eligibility</span>
          <div className="portal-field--check">
            <input
              id="donation-eligible"
              type="checkbox"
              checked={isEligible}
              onChange={(event) => setIsEligible(event.target.checked)}
            />
            <label htmlFor="donation-eligible">
              This food is safe and eligible for rescue
            </label>
          </div>
        </div>
      </div>

      <div className="portal-form__actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : donation ? 'Save changes' : 'List package'}
        </button>
        <button type="button" className="btn-secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

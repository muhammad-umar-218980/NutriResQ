import { useState, type FormEvent } from 'react'
import { Card, ErrorState, LoadingRows, PageHeader } from '../../components/app/ui'
import { useApi } from '../../hooks/useApi'
import { fieldErrorsFrom } from '../../lib/api'
import { createVehicle, deleteVehicle, updateVehicle } from '../../lib/portal-api'
import { formatDateTime } from '../../lib/format'
import type {
  DeliveryWorkspaceResponse,
  LocationsResponse,
  PortalVehicle,
  VehicleBody,
} from '../../types/portal'
import './PortalWorkspace.css'

export default function DeliveryVehiclesPage() {
  const { data, error, loading, reload } = useApi<DeliveryWorkspaceResponse>('/api/portal/delivery')

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const workspace = data?.workspace ?? null
  const vehicles = workspace?.vehicles ?? []
  const editing = editingId ? (vehicles.find((item) => item.id === editingId) ?? null) : null
  const defaultScenarioId = workspace?.scenarios[0]?.id ?? ''

  function openCreate() {
    setEditingId(null)
    setFormOpen(true)
    setActionError(null)
  }

  function openEdit(vehicle: PortalVehicle) {
    setEditingId(vehicle.id)
    setFormOpen(true)
    setActionError(null)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
  }

  async function removeVehicleRow(vehicle: PortalVehicle) {
    setPendingId(vehicle.id)
    setActionError(null)
    try {
      await deleteVehicle(vehicle.id)
      setConfirmingId(null)
      reload()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The vehicle could not be deleted.')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Delivery Partner"
        title="My fleet"
        description="Vehicles the optimizer may use. Capacity is whole kilograms and a start location is required for a vehicle to be routed at all."
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
          <LoadingRows label="Loading your fleet…" />
        </Card>
      ) : !workspace ? (
        <Card>
          <ErrorState message="Your fleet could not be loaded." onRetry={reload} />
        </Card>
      ) : (
        <>
          <Card
            title="Fleet summary"
            description="Vehicles without a start location are excluded from routing runs and reported as `vehicle-missing-start`."
            actions={
              formOpen ? null : (
                <button type="button" className="btn-primary btn-secondary--small" onClick={openCreate}>
                  Add a vehicle
                </button>
              )
            }
          >
            <p className="portal-facts">
              <span>
                Vehicles: <strong>{vehicles.length}</strong>
              </span>
              <span>
                Available:{' '}
                <strong>{vehicles.filter((vehicle) => vehicle.isAvailable).length}</strong>
              </span>
              <span>
                Total capacity:{' '}
                <strong>
                  {vehicles
                    .filter((vehicle) => vehicle.isAvailable)
                    .reduce((sum, vehicle) => sum + vehicle.capacityUnits, 0)}{' '}
                  kg
                </strong>
              </span>
            </p>
          </Card>

          {formOpen ? (
            <Card
              title={editing ? `Edit ${editing.name}` : 'Add a vehicle'}
              description="Capacity is the total weight the vehicle can carry in one run."
            >
              <VehicleForm
                key={editing?.id ?? 'new'}
                vehicle={editing}
                scenarios={workspace.scenarios}
                defaultScenarioId={defaultScenarioId}
                onSaved={() => {
                  closeForm()
                  reload()
                }}
                onCancel={closeForm}
              />
            </Card>
          ) : null}

          <Card
            title="Vehicles"
            description="Only vehicles owned by your account are listed and editable."
          >
            {vehicles.length === 0 ? (
              <p className="portal-empty">
                No vehicles are linked to your account yet. Use “Add a vehicle” to register one.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <caption>Vehicles owned by this delivery partner.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Vehicle</th>
                      <th scope="col">Capacity</th>
                      <th scope="col">Start location</th>
                      <th scope="col">Availability</th>
                      <th scope="col">Updated</th>
                      <th scope="col" className="data-table__actions">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((vehicle) => {
                      const busy = pendingId === vehicle.id
                      return (
                        <tr key={vehicle.id}>
                          <th scope="row">
                            <span className="data-table__name">{vehicle.name}</span>
                            <span className="data-table__sub">
                              {vehicle.startLocationId
                                ? 'Routable'
                                : 'Excluded — no start location'}
                            </span>
                          </th>
                          <td>{vehicle.capacityUnits} kg</td>
                          <td>{vehicle.startLocationName ?? 'Not set'}</td>
                          <td>
                            <span
                              className={`status-badge ${
                                vehicle.isAvailable
                                  ? 'status-badge--available'
                                  : 'status-badge--unavailable'
                              }`}
                            >
                              {vehicle.isAvailable ? 'Available' : 'Unavailable'}
                            </span>
                          </td>
                          <td>{formatDateTime(vehicle.updatedAt)}</td>
                          <td className="data-table__actions">
                            {confirmingId === vehicle.id ? (
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="btn-danger"
                                  disabled={busy}
                                  onClick={() => void removeVehicleRow(vehicle)}
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
                                  onClick={() => openEdit(vehicle)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn-quiet"
                                  onClick={() => setConfirmingId(vehicle.id)}
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

function VehicleForm({
  vehicle,
  scenarios,
  defaultScenarioId,
  onSaved,
  onCancel,
}: {
  vehicle: PortalVehicle | null
  scenarios: Array<{ id: string; name: string }>
  defaultScenarioId: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [scenarioId, setScenarioId] = useState(vehicle?.scenarioId ?? defaultScenarioId)
  const [name, setName] = useState(vehicle?.name ?? '')
  const [capacityUnits, setCapacityUnits] = useState(String(vehicle?.capacityUnits ?? 20))
  const [startLocationId, setStartLocationId] = useState(vehicle?.startLocationId ?? '')
  const [isAvailable, setIsAvailable] = useState(vehicle?.isAvailable ?? true)

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const locations = useApi<LocationsResponse>(
    scenarioId ? `/api/portal/scenarios/${encodeURIComponent(scenarioId)}/locations` : null,
  )
  const locationOptions = locationIdOptions(locations.data)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setFieldErrors({})

    const capacity = Number(capacityUnits)
    if (!scenarioId) {
      setFieldErrors({ scenarioId: 'Choose the scenario this vehicle belongs to.' })
      return
    }
    if (!Number.isInteger(capacity) || capacity <= 0) {
      setFieldErrors({ capacityUnits: 'Enter a whole number of kilograms, at least 1.' })
      return
    }

    const body: VehicleBody = {
      scenarioId,
      name: name.trim(),
      capacityUnits: capacity,
      startLocationId: startLocationId || null,
      isAvailable,
    }

    setSaving(true)
    try {
      if (vehicle) {
        await updateVehicle(vehicle.id, body)
      } else {
        await createVehicle(body)
      }
      onSaved()
    } catch (cause) {
      setFieldErrors(fieldErrorsFrom(cause))
      setFormError(cause instanceof Error ? cause.message : 'The vehicle could not be saved.')
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
          <label htmlFor="vehicle-scenario">Scenario</label>
          <select
            id="vehicle-scenario"
            value={scenarioId}
            onChange={(event) => {
              setScenarioId(event.target.value)
              setStartLocationId('')
            }}
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
          {fieldErrors.scenarioId ? (
            <p className="portal-field__error">{fieldErrors.scenarioId}</p>
          ) : null}
        </div>

        <div className="portal-field">
          <label htmlFor="vehicle-name">Vehicle name</label>
          <input
            id="vehicle-name"
            type="text"
            maxLength={80}
            value={name}
            required
            placeholder="Van D — 40"
            onChange={(event) => setName(event.target.value)}
          />
          {fieldErrors.name ? <p className="portal-field__error">{fieldErrors.name}</p> : null}
        </div>

        <div className="portal-field">
          <label htmlFor="vehicle-capacity">Capacity (kg)</label>
          <input
            id="vehicle-capacity"
            type="number"
            min={1}
            step={1}
            value={capacityUnits}
            required
            onChange={(event) => setCapacityUnits(event.target.value)}
          />
          {fieldErrors.capacityUnits ? (
            <p className="portal-field__error">{fieldErrors.capacityUnits}</p>
          ) : (
            <p className="portal-field__hint">Total weight the vehicle can carry in one run.</p>
          )}
        </div>

        <div className="portal-field">
          <label htmlFor="vehicle-start">Start location</label>
          <select
            id="vehicle-start"
            value={startLocationId}
            onChange={(event) => setStartLocationId(event.target.value)}
            disabled={!scenarioId || (locations.loading && locationOptions.length === 0)}
          >
            <option value="">Not set — vehicle will be excluded</option>
            {locationOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          {locations.error ? (
            <p className="portal-field__error">{locations.error}</p>
          ) : (
            <p className="portal-field__hint">
              {locations.loading && locationOptions.length === 0
                ? 'Loading scenario locations…'
                : 'Routes start and end here.'}
            </p>
          )}
        </div>

        <div className="portal-field">
          <span className="portal-field__label">Availability</span>
          <div className="portal-field--check">
            <input
              id="vehicle-available"
              type="checkbox"
              checked={isAvailable}
              onChange={(event) => setIsAvailable(event.target.checked)}
            />
            <label htmlFor="vehicle-available">Offer this vehicle to the next run</label>
          </div>
        </div>
      </div>

      <div className="portal-form__actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : vehicle ? 'Save changes' : 'Add vehicle'}
        </button>
        <button type="button" className="btn-secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function locationIdOptions(data: LocationsResponse | null): Array<{ id: string; name: string }> {
  return data?.locations.map((location) => ({ id: location.id, name: location.name })) ?? []
}

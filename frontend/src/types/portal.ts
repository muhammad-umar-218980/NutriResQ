/**
 * Mirrors the `/api/portal` contracts. These shapes are role-scoped by the
 * backend: a donor only ever receives its own donations, a recipient only the
 * donations addressed to it, a delivery partner only its own vehicles.
 */

export type DonationStatus = 'available' | 'expired' | 'reserved' | 'unavailable'

export interface PortalDonor {
  id: string
  scenarioId: string
  name: string
  donorType: string | null
  isActive: boolean
  locationId: string
  locationName: string
}

export interface PortalRecipient {
  id: string
  scenarioId: string
  name: string
  recipientType: string | null
  demandUnits: number
  priorityScore: number
  isAvailable: boolean
  locationId: string
  locationName: string
}

export interface PortalDonation {
  id: string
  donorId: string
  donorName: string
  packageName: string
  weightUnits: number
  valueScore: number
  recipientId: string | null
  recipientName: string | null
  availableAt: string | null
  expiresAt: string | null
  isEligible: boolean
  status: DonationStatus
  updatedAt: string
}

export interface PortalVehicle {
  id: string
  scenarioId: string
  name: string
  capacityUnits: number
  startLocationId: string | null
  startLocationName: string | null
  isAvailable: boolean
  updatedAt: string
}

export interface PortalAssignment {
  routeId: string
  runId: string
  vehicleId: string
  vehicleName: string | null
  routeStatus: string
  totalCost: number
  costUnit: string
  infeasibleReason: string | null
  runStatus: string
  startedAt: string
  completedAt: string | null
  stopCount: number
}

export interface PortalScenario {
  id: string
  name: string
  status: string
}

export interface PortalLocation {
  id: string
  name: string
  locationType: string
}

export interface DonorWorkspaceResponse {
  success: boolean
  workspace: {
    donor: PortalDonor
    donations: PortalDonation[]
    recipients: Array<{ id: string; name: string }>
  }
}

export interface RecipientWorkspaceResponse {
  success: boolean
  workspace: {
    recipient: PortalRecipient
    donations: PortalDonation[]
  }
}

export interface DeliveryWorkspaceResponse {
  success: boolean
  workspace: {
    vehicles: PortalVehicle[]
    assignments: PortalAssignment[]
    scenarios: PortalScenario[]
  }
}

export interface ScenariosResponse {
  success: boolean
  scenarios: PortalScenario[]
}

export interface LocationsResponse {
  success: boolean
  locations: PortalLocation[]
}

export interface DonationResponse {
  success: boolean
  donation: PortalDonation
}

export interface VehicleResponse {
  success: boolean
  vehicle: PortalVehicle
}

export interface RecipientResponse {
  success: boolean
  recipient: PortalRecipient
}

export interface DonationBody {
  packageName: string
  weightUnits: number
  valueScore: number
  recipientId: string | null
  availableAt: string | null
  expiresAt: string | null
  isEligible: boolean
  status: DonationStatus
}

export interface RecipientBody {
  recipientType?: string | null
  demandUnits?: number
  priorityScore?: number
  isAvailable?: boolean
}

export interface VehicleBody {
  scenarioId: string
  name: string
  capacityUnits: number
  startLocationId: string | null
  isAvailable: boolean
}

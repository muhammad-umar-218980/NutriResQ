/** Typed calls for the role-scoped portal endpoints. */

import { apiRequest } from './api'
import type {
  DeliveryWorkspaceResponse,
  DonationBody,
  DonationResponse,
  DonorWorkspaceResponse,
  LocationsResponse,
  RecipientBody,
  RecipientResponse,
  RecipientWorkspaceResponse,
  ScenariosResponse,
  VehicleBody,
  VehicleResponse,
} from '../types/portal'

export function getDonorWorkspace(): Promise<DonorWorkspaceResponse> {
  return apiRequest<DonorWorkspaceResponse>('/api/portal/donor')
}

export function createDonation(body: DonationBody): Promise<DonationResponse> {
  return apiRequest<DonationResponse>('/api/portal/donor/donations', {
    method: 'POST',
    body,
  })
}

export function updateDonation(id: string, body: DonationBody): Promise<DonationResponse> {
  return apiRequest<DonationResponse>(`/api/portal/donor/donations/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
  })
}

export function deleteDonation(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/api/portal/donor/donations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function getRecipientWorkspace(): Promise<RecipientWorkspaceResponse> {
  return apiRequest<RecipientWorkspaceResponse>('/api/portal/recipient')
}

export function updateRecipientProfile(body: RecipientBody): Promise<RecipientResponse> {
  return apiRequest<RecipientResponse>('/api/portal/recipient', {
    method: 'PATCH',
    body,
  })
}

export function getDeliveryWorkspace(): Promise<DeliveryWorkspaceResponse> {
  return apiRequest<DeliveryWorkspaceResponse>('/api/portal/delivery')
}

export function createVehicle(body: VehicleBody): Promise<VehicleResponse> {
  return apiRequest<VehicleResponse>('/api/portal/delivery/vehicles', {
    method: 'POST',
    body,
  })
}

export function updateVehicle(id: string, body: VehicleBody): Promise<VehicleResponse> {
  return apiRequest<VehicleResponse>(`/api/portal/delivery/vehicles/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
  })
}

export function deleteVehicle(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(
    `/api/portal/delivery/vehicles/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}

export function getPortalScenarios(): Promise<ScenariosResponse> {
  return apiRequest<ScenariosResponse>('/api/portal/scenarios')
}

export function getPortalLocations(scenarioId: string): Promise<LocationsResponse> {
  return apiRequest<LocationsResponse>(
    `/api/portal/scenarios/${encodeURIComponent(scenarioId)}/locations`,
  )
}

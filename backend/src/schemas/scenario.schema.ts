/**
 * Request contracts for the scenario simulator. Every simulator route is
 * admin-only and takes the scenario id from the path, so a body can never
 * redirect an edit to another scenario.
 */

import { z } from 'zod';

export const roadParams = z.object({ id: z.string().uuid(), roadId: z.string().uuid() });
export const vehicleParams = z.object({ id: z.string().uuid(), vehicleId: z.string().uuid() });
export const donationParams = z.object({ id: z.string().uuid(), donationId: z.string().uuid() });
export const recipientParams = z.object({ id: z.string().uuid(), recipientId: z.string().uuid() });

const atLeastOne = (value: Record<string, unknown>, fields: string[]): boolean =>
  fields.some((field) => value[field] !== undefined);

export const cloneScenarioSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export const roadUpdateSchema = z.object({
  isAvailable: z.boolean(),
});

export const vehicleUpdateSchema = z
  .object({
    isAvailable: z.boolean().optional(),
    capacityUnits: z.number().int().min(1).max(5000).optional(),
    /** Explicit opt-in when the edit pushes the exact DP state space over the limit. */
    allowLargeStateSpace: z.boolean().optional(),
  })
  .refine((value) => atLeastOne(value, ['isAvailable', 'capacityUnits']), {
    message: 'Provide isAvailable or capacityUnits.',
  });

export const donationUpdateSchema = z
  .object({
    weightUnits: z.number().int().min(1).max(100_000).optional(),
    valueScore: z.number().int().min(0).max(100).optional(),
    status: z.enum(['available', 'expired', 'reserved', 'unavailable']).optional(),
  })
  .refine((value) => atLeastOne(value, ['weightUnits', 'valueScore', 'status']), {
    message: 'Provide weightUnits, valueScore or status.',
  });

export const recipientUpdateSchema = z
  .object({
    demandUnits: z.number().int().min(0).max(100_000).optional(),
    priorityScore: z.number().int().min(0).max(100).optional(),
    isAvailable: z.boolean().optional(),
  })
  .refine((value) => atLeastOne(value, ['demandUnits', 'priorityScore', 'isAvailable']), {
    message: 'Provide demandUnits, priorityScore or isAvailable.',
  });

export const supplyReduceSchema = z.object({
  percent: z.number().gt(0).lte(100),
});

export const sensitivitySchema = z.object({
  removeTopUrgencyCount: z.number().int().min(1).max(10),
  name: z.string().trim().min(1).max(120).optional(),
});

export const compareQuerySchema = z.object({
  baseRunId: z.string().uuid(),
  variantRunId: z.string().uuid(),
});

export const scenarioChangesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type CloneScenarioBody = z.infer<typeof cloneScenarioSchema>;
export type RoadUpdateBody = z.infer<typeof roadUpdateSchema>;
export type VehicleUpdateBody = z.infer<typeof vehicleUpdateSchema>;
export type DonationUpdateBody = z.infer<typeof donationUpdateSchema>;
export type RecipientUpdateBody = z.infer<typeof recipientUpdateSchema>;
export type SupplyReduceBody = z.infer<typeof supplyReduceSchema>;
export type SensitivityBody = z.infer<typeof sensitivitySchema>;

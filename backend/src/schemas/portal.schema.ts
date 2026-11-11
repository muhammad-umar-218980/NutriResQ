import { z } from 'zod';

const isoDateTime = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Enter a valid date and time.',
  });

const nullableIsoDateTime = isoDateTime.nullable();

export const donationStatusSchema = z.enum(['available', 'expired', 'reserved', 'unavailable']);

export const donationCreateSchema = z.object({
  packageName: z.string().trim().min(1).max(120),
  weightUnits: z.number().int().min(1).max(100_000),
  valueScore: z.number().int().min(0).max(100),
  recipientId: z.string().uuid().nullable().optional(),
  availableAt: nullableIsoDateTime.optional(),
  expiresAt: nullableIsoDateTime.optional(),
  isEligible: z.boolean().optional(),
  status: donationStatusSchema.optional(),
});

export const donationUpdateSchema = donationCreateSchema;

export const recipientUpdateSchema = z.object({
  recipientType: z.string().trim().max(60).nullable().optional(),
  demandUnits: z.number().int().min(0).max(1_000_000).optional(),
  priorityScore: z.number().int().min(0).max(100).optional(),
  isAvailable: z.boolean().optional(),
});

export const vehicleCreateSchema = z.object({
  scenarioId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  capacityUnits: z.number().int().min(1).max(100_000),
  startLocationId: z.string().uuid().nullable().optional(),
  isAvailable: z.boolean().optional(),
});

export const vehicleUpdateSchema = vehicleCreateSchema;

export const portalIdParams = z.object({
  id: z.string().uuid(),
});

export const portalScenarioParams = z.object({
  id: z.string().uuid(),
});

export type DonationCreateBody = z.infer<typeof donationCreateSchema>;
export type RecipientUpdateBody = z.infer<typeof recipientUpdateSchema>;
export type VehicleCreateBody = z.infer<typeof vehicleCreateSchema>;

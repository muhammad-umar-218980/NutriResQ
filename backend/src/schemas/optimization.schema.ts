import { z } from 'zod';

const acoOverrides = z.object({
  numAnts: z.number().int().min(0).max(1_000).optional(),
  numTrials: z.number().int().min(1).max(10_000).optional(),
  evaporationRate: z.number().gt(0).lt(1).optional(),
  alpha: z.number().min(0).max(100).optional(),
  beta: z.number().min(0).max(100).optional(),
  seed: z.number().int().min(-1).max(2_147_483_646).optional(),
});

const knapsackOverrides = z.object({
  maxStates: z.number().int().min(1).max(5_000_000).optional(),
});

export const algorithmOverridesSchema = z.object({
  astarHeuristic: z.enum(['projected-distance', 'zero']).optional(),
  knapsack: knapsackOverrides.optional(),
  aco: acoOverrides.optional(),
});

export const optimizeSchema = z.object({
  scenarioId: z.string().uuid(),
  overrides: algorithmOverridesSchema.optional(),
});

export type OptimizeBody = z.infer<typeof optimizeSchema>;

export const algorithmBaseSchema = z.object({
  scenarioId: z.string().uuid(),
  overrides: algorithmOverridesSchema.optional(),
});

export const astarSchema = z.object({
  scenarioId: z.string().uuid(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  heuristic: z.enum(['projected-distance', 'zero']).default('projected-distance'),
});

export const knapsackSchema = z.object({
  scenarioId: z.string().uuid(),
  maxStates: z.number().int().min(1).max(5_000_000).optional(),
});

export const closestPairSchema = z.object({
  scenarioId: z.string().uuid(),
});

export const acoSchema = z.object({
  scenarioId: z.string().uuid(),
  overrides: algorithmOverridesSchema.optional(),
});

export const runIdParams = z.object({
  id: z.string().uuid(),
});

export const scenarioIdParams = z.object({
  id: z.string().uuid(),
});

export const scenarioRunsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const runListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

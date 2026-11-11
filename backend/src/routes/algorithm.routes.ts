import { Router } from 'express';
import type { z } from 'zod';
import { ValidationError } from '../errors/app-error';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  acoSchema,
  astarSchema,
  closestPairSchema,
  knapsackSchema,
} from '../schemas/optimization.schema';
import {
  evaluateAco,
  evaluateAstar,
  evaluateClosestPair,
  evaluateKnapsack,
} from '../services/algorithm.service';

const router = Router();

router.use(requireAuth, requireRole('admin'));

function rethrowConfigError(error: unknown): never {
  if (error instanceof RangeError) throw new ValidationError(error.message);
  throw error;
}

router.post(
  '/astar',
  validate({ body: astarSchema }),
  async (req, res) => {
    const body = req.validated.body as z.infer<typeof astarSchema>;
    res.json({ success: true, evaluation: await evaluateAstar(body) });
  },
);

router.post(
  '/knapsack',
  validate({ body: knapsackSchema }),
  async (req, res) => {
    const body = req.validated.body as z.infer<typeof knapsackSchema>;
    try {
      res.json({ success: true, evaluation: await evaluateKnapsack(body) });
    } catch (error) {
      rethrowConfigError(error);
    }
  },
);

router.post(
  '/closest-pair',
  validate({ body: closestPairSchema }),
  async (req, res) => {
    const body = req.validated.body as z.infer<typeof closestPairSchema>;
    res.json({ success: true, evaluation: await evaluateClosestPair(body) });
  },
);

router.post(
  '/aco',
  validate({ body: acoSchema }),
  async (req, res) => {
    const body = req.validated.body as z.infer<typeof acoSchema>;
    try {
      res.json({ success: true, evaluation: await evaluateAco(body) });
    } catch (error) {
      rethrowConfigError(error);
    }
  },
);

export default router;

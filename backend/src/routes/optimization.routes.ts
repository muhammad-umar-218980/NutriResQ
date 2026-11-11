import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { optimizeSchema, type OptimizeBody } from '../schemas/optimization.schema';
import { createOptimizationRun } from '../services/run.service';

const router = Router();

/** POST /api/optimize - run the integrated pipeline and persist the result. */
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  validate({ body: optimizeSchema }),
  async (req, res) => {
    const body = req.validated.body as OptimizeBody;

    const run = await createOptimizationRun({
      scenarioId: body.scenarioId,
      runBy: req.auth?.id ?? null,
      overrides: body.overrides,
    });

    res.status(201).json({ success: true, run });
  },
);

export default router;

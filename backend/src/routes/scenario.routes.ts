import { Router } from 'express';
import { z } from 'zod';
import { NotFoundError } from '../errors/app-error';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { findScenarioById, listScenarios, loadScenarioSnapshot } from '../repositories/scenario.repository';
import { scenarioIdParams, scenarioRunsQuery } from '../schemas/optimization.schema';
import { getScenarioRuns } from '../services/run.service';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', async (_req, res) => {
  const scenarios = await listScenarios();
  res.json({ success: true, scenarios });
});

router.get('/:id', validate({ params: scenarioIdParams }), async (req, res) => {
  const scenario = await findScenarioById(String(req.params.id));
  if (!scenario) throw new NotFoundError('No scenario matches that id.');
  res.json({ success: true, scenario });
});

router.get('/:id/snapshot', validate({ params: scenarioIdParams }), async (req, res) => {
  const snapshot = await loadScenarioSnapshot(String(req.params.id));
  if (!snapshot) throw new NotFoundError('No scenario matches that id.');
  res.json({ success: true, snapshot });
});

router.get(
  '/:id/runs',
  validate({ params: scenarioIdParams, query: scenarioRunsQuery }),
  async (req, res) => {
    const query = req.validated.query as z.infer<typeof scenarioRunsQuery>;
    const scenario = await findScenarioById(String(req.params.id));
    if (!scenario) throw new NotFoundError('No scenario matches that id.');

    const runs = await getScenarioRuns(scenario.id, query.page, query.pageSize);
    res.json({ success: true, ...runs });
  },
);

export default router;

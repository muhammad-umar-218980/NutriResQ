import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { runIdParams } from '../schemas/optimization.schema';
import { getRun } from '../services/run.service';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/:id', validate({ params: runIdParams }), async (req, res) => {
  const run = await getRun(String(req.params.id));
  res.json({ success: true, run });
});

export default router;

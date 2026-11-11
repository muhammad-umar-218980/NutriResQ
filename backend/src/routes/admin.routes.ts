import { Router } from 'express';
import { z } from 'zod';
import { NotFoundError } from '../errors/app-error';
import { applySessionCookie } from '../lib/session-cookie';
import { requireAuth, requireRole } from '../middleware/auth';
import { clearLoginAttempts, loginRateLimit, recordLoginFailure } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';
import { revokeAllSessionsForUser } from '../repositories/session.repository';
import {
  listUsers,
  roleCounts,
  updateStatus,
  findUserWithProfileById,
} from '../repositories/user.repository';
import { adminLoginSchema, type AdminLoginBody } from '../schemas/auth.schema';
import { loginUser } from '../services/auth.service';
import type { Request } from 'express';

const router = Router();

/** /api/admin/auth/login - the only admin entry point, not linked from the UI. */
router.post(
  '/auth/login',
  loginRateLimit,
  validate({ body: adminLoginSchema }),
  async (req, res, next) => {
    const body = req.validated.body as AdminLoginBody;

    try {
      const result = await loginUser(
        { portal: 'admin', email: body.email, password: body.password, remember: body.remember },
        { userAgent: req.header('user-agent') ?? null, ip: req.ip ?? null },
      );

      clearLoginAttempts(req);
      applySessionCookie(res, result.token, result.expiresAt);

      res.json({ success: true, role: 'admin', user: result.user, expiresAt: result.expiresAt });
    } catch (error) {
      recordLoginFailure(req);
      next(error);
    }
  },
);

router.get('/stats', requireAuth, requireRole('admin'), async (_req, res) => {
  const counts = await roleCounts();
  const byRole: Record<string, { total: number; active: number; suspended: number; unverified: number }> =
    {};

  for (const entry of counts) {
    byRole[entry.role] = {
      total: entry.total,
      active: entry.active,
      suspended: entry.suspended,
      unverified: entry.unverified,
    };
  }

  const totals = counts.reduce(
    (sum, entry) => ({
      users: sum.users + entry.total,
      active: sum.active + entry.active,
      suspended: sum.suspended + entry.suspended,
      unverified: sum.unverified + entry.unverified,
    }),
    { users: 0, active: 0, suspended: 0, unverified: 0 },
  );

  res.json({
    success: true,
    data: { byRole, totals, generatedAt: new Date().toISOString() },
  });
});

const userListQuery = z.object({
  role: z.enum(['donor', 'recipient', 'delivery', 'admin']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

router.get(
  '/users',
  requireAuth,
  requireRole('admin'),
  validate({ query: userListQuery }),
  async (req, res) => {
    const q = req.validated.query as z.infer<typeof userListQuery>;

    const result = await listUsers({
      role: q.role,
      status: q.status,
      search: q.q,
      page: q.page,
      pageSize: q.pageSize,
    });

    res.json({ success: true, ...result });
  },
);

router.get('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const user = await findUserWithProfileById(String(req.params.id));
  if (!user) throw new NotFoundError('No account matches that id.');
  res.json({ success: true, user });
});

const statusBody = z.object({ status: z.enum(['active', 'suspended']) });

router.patch(
  '/users/:id/status',
  requireAuth,
  requireRole('admin'),
  validate({ body: statusBody }),
  async (req: Request, res) => {
    const { status } = req.validated.body as z.infer<typeof statusBody>;
    const updated = await updateStatus(String(req.params.id), status);

    if (!updated) throw new NotFoundError('No account matches that id.');

    // Suspension must take effect now, not when the session happens to expire.
    if (status === 'suspended') {
      await revokeAllSessionsForUser(updated.id);
    }

    res.json({
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        status: updated.status,
      },
    });
  },
);

export default router;

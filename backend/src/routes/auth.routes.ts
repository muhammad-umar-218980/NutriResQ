import { Router } from 'express';
import { clearedCookieOptions, SESSION_COOKIE } from '../lib/session-cookie';
import { applySessionCookie } from '../lib/session-cookie';
import { requireAuth } from '../middleware/auth';
import { clearLoginAttempts, loginRateLimit, recordLoginFailure } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type LoginBody,
  type RegisterBody,
} from '../schemas/auth.schema';
import {
  getPublicUser,
  loginUser,
  logoutSession,
  registerUser,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyEmailToken,
  type SessionMeta,
} from '../services/auth.service';
import type { Request } from 'express';

const router = Router();

function sessionMeta(req: Request): SessionMeta {
  return {
    userAgent: req.header('user-agent') ?? null,
    ip: req.ip ?? null,
  };
}

router.post('/register', validate({ body: registerSchema }), async (req, res) => {
  const body = req.validated.body as RegisterBody;

  const result = await registerUser(
    {
      portal: body.portal,
      email: body.email,
      phone: body.phone,
      password: body.password,
      profile: body.profile as unknown as Record<string, string>,
    },
    sessionMeta(req),
  );

  applySessionCookie(res, result.token, result.expiresAt);

  res.status(201).json({
    success: true,
    role: result.user.role,
    user: result.user,
    expiresAt: result.expiresAt,
    message: 'Your account is ready. You are signed in.',
    ...(result.verificationUrl ? { verificationUrl: result.verificationUrl } : {}),
  });
});

router.post('/login', loginRateLimit, validate({ body: loginSchema }), async (req, res, next) => {
  const body = req.validated.body as LoginBody;

  try {
    const result = await loginUser(
      {
        portal: body.portal,
        email: body.email,
        password: body.password,
        remember: body.remember,
      },
      sessionMeta(req),
    );

    clearLoginAttempts(req);
    applySessionCookie(res, result.token, result.expiresAt);

    res.json({
      success: true,
      role: result.user.role,
      user: result.user,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    recordLoginFailure(req);
    next(error);
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  if (req.auth) await logoutSession(req.auth.sessionId);
  res.clearCookie(SESSION_COOKIE, clearedCookieOptions());
  res.json({ success: true, message: 'You are signed out.' });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = req.auth ? await getPublicUser(req.auth.id) : null;

  if (!user) {
    res.clearCookie(SESSION_COOKIE, clearedCookieOptions());
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Your session has expired. Please sign in again.' },
    });
    return;
  }

  res.json({ success: true, role: user.role, user });
});

router.post(
  '/forgot-password',
  validate({ body: forgotPasswordSchema }),
  async (req, res) => {
    const body = req.validated.body as { email: string };
    const dev = await requestPasswordReset(body.email);

    // Identical response whether or not the address exists.
    res.json({
      success: true,
      message: 'If that email is registered, a reset link is on its way.',
      ...(dev.devUrl ? { resetUrl: dev.devUrl } : {}),
    });
  },
);

router.post('/reset-password', validate({ body: resetPasswordSchema }), async (req, res) => {
  const body = req.validated.body as { token: string; password: string };
  await resetPassword(body.token, body.password);

  res.clearCookie(SESSION_COOKIE, clearedCookieOptions());
  res.json({ success: true, message: 'Your password has been updated. Sign in with the new one.' });
});

router.post('/verify-email', validate({ body: verifyEmailSchema }), async (req, res) => {
  const body = req.validated.body as { token: string };
  const result = await verifyEmailToken(body.token);
  res.json({ success: true, email: result.email, message: 'Email address verified.' });
});

router.post('/resend-verification', requireAuth, async (req, res) => {
  const dev = await resendVerification(req.auth!.id);
  res.json({
    success: true,
    message: dev.devUrl
      ? 'Verification link generated. Email delivery is not configured, so the link is shown here.'
      : 'If the address is unverified, a new link has been sent.',
    ...(dev.devUrl ? { verificationUrl: dev.devUrl } : {}),
  });
});

export default router;

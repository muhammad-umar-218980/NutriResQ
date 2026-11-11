import cors from 'cors';
import express from 'express';
import { env, isProduction } from './config/env';
import { pingDatabase } from './db/pool';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestId } from './middleware/request-id';
import { requireTrustedOrigin } from './middleware/csrf';
import adminRoutes from './routes/admin.routes';
import algorithmRoutes from './routes/algorithm.routes';
import authRoutes from './routes/auth.routes';
import optimizationRoutes from './routes/optimization.routes';
import portalRoutes from './routes/portal.routes';
import runRoutes from './routes/run.routes';
import scenarioRoutes from './routes/scenario.routes';

const app = express();

app.disable('x-powered-by');
// Needed for req.ip behind a reverse proxy (and for the login rate limiter).
app.set('trust proxy', 1);

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  }),
);

app.use(requestId);
app.use(express.json({ limit: '1mb' }));
app.use(requireTrustedOrigin);

if (!isProduction) {
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - startedAt;
      console.log(`[api] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
    });
    next();
  });
}

app.get('/', (_req, res) => {
  res.json({
    success: true,
    data: { name: 'NutriResQ API', version: '2.0.0' },
  });
});

app.get('/api/health', async (_req, res) => {
  const database = await pingDatabase();

  res.status(database.ok ? 200 : 503).json({
    success: database.ok,
    data: {
      api: 'up',
      database: database.ok ? 'up' : 'down',
      databaseLatencyMs: database.latencyMs,
      timestamp: new Date().toISOString(),
    },
    ...(database.ok ? {} : { error: { code: 'INTERNAL_ERROR', message: 'Database unreachable' } }),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/scenarios', scenarioRoutes);
app.use('/api/optimize', optimizationRoutes);
app.use('/api/runs', runRoutes);
app.use('/api/algorithms', algorithmRoutes);
app.use('/api/portal', portalRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

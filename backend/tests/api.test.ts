import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// Must be set before `../src/app` is imported: env.ts validates at import time
// and dotenv never overrides values that already exist. No query is made against
// this placeholder database; the suite only exercises guards and validation.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://nutriresq:nutriresq@127.0.0.1:5432/nutriresq_test';
process.env.SESSION_TOKEN_PEPPER = 'test-pepper-0123456789abcdef';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.PORT = '4000';
process.env.ADMIN_EMAIL = 'admin@nutriresq.local';
process.env.ADMIN_PASSWORD = 'ChangeMe-Admin-2026';
process.env.DEMO_PASSWORD = 'Demo-Pass-2026';

let app: Express;

beforeAll(async () => {
  const imported = await import('../src/app');
  app = imported.default;
});

afterAll(async () => {
  const { pool } = await import('../src/db/pool');
  await pool.end();
});

describe('API surface without a database', () => {
  it('serves the root banner', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('NutriResQ API');
  });

  it('returns a JSON 404 envelope for unknown routes', async () => {
    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('guards every authenticated area with 401 when no session cookie is sent', async () => {
    const guarded: Array<[string, string]> = [
      ['get', '/api/scenarios'],
      ['get', '/api/scenarios/00000000-0000-4000-8000-000000000001/snapshot'],
      ['get', '/api/runs/00000000-0000-4000-8000-000000000001'],
      ['get', '/api/admin/users'],
      ['get', '/api/admin/stats'],
      ['get', '/api/portal/scenarios'],
      ['get', '/api/portal/donor'],
      ['get', '/api/portal/recipient'],
      ['get', '/api/portal/delivery'],
      ['post', '/api/optimize'],
      ['post', '/api/algorithms/astar'],
      ['post', '/api/algorithms/knapsack'],
      ['post', '/api/algorithms/closest-pair'],
      ['post', '/api/algorithms/aco'],
    ];

    for (const [method, path] of guarded) {
      const response =
        method === 'get'
          ? await request(app).get(path)
          : await request(app).post(path).send({});

      expect(response.status, `${method.toUpperCase()} ${path}`).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('rejects state-changing requests from an untrusted origin', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://evil.example')
      .send({ portal: 'donor', email: 'a@b.com', password: 'whatever' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows state-changing requests from the configured frontend origin', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({});

    // Validation (422) runs after the origin check, so the request was allowed through.
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validates login bodies before any database access', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ portal: 'not-a-portal', email: 'not-an-email', password: '' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.fields).toMatchObject({
      'body.portal': expect.any(String),
      'body.email': expect.any(String),
      'body.password': expect.any(String),
    });
  });

  it('validates registration bodies per portal', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ portal: 'donor', email: 'x@y.com', phone: '+44 7700 900123', password: 'long-enough' });

    expect(response.status).toBe(422);
    expect(response.body.error.details.fields['body.profile']).toBeTruthy();
  });

  it('echoes a caller-provided request id', async () => {
    const response = await request(app).get('/').set('X-Request-Id', 'test-request-123');

    expect(response.headers['x-request-id']).toBe('test-request-123');
  });

  it('answers CORS preflight for the configured frontend origin', async () => {
    const response = await request(app)
      .options('/api/optimize')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBeLessThan(400);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

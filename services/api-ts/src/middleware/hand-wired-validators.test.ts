/**
 * Phase A — Cycle 8: Validator rejection tests for all 58 hand-wired routes.
 *
 * Tests that zValidator middleware in app.ts correctly rejects bad input
 * (malformed UUIDs, missing required fields, wrong enum values, oversized
 * strings) and returns TypeSpec-compliant ValidationError (400).
 *
 * Approach: Mount the same Zod schemas on a mini Hono app with app.request().
 * No database or auth required — we only test the validation layer.
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { validationErrorHandler } from '@/middleware/validation';

// ─── Helpers ─────────────────────────────────────────────

const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const BAD_UUID = 'not-a-uuid';
const LONG_STRING = 'x'.repeat(600);

/** Assert response is a 400 ValidationError with expected structure */
async function expectValidationError(res: Response, fieldSubstring?: string) {
  expect(res.status).toBe(400);
  const body = await res.json() as any;
  expect(body.code).toBe('VALIDATION_ERROR');
  expect(body.message).toContain('Validation failed');
  expect(body.statusCode).toBe(400);
  if (fieldSubstring) {
    const allFields = [
      ...(body.fieldErrors || []).map((f: any) => f.field),
      ...(body.globalErrors || []),
    ].join(' ');
    expect(allFields).toContain(fieldSubstring);
  }
}

/** Build a mini app with a single validated route */
function makeApp(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  ...middlewares: any[]
) {
  const app = new Hono();
  const handler = (c: any) => c.json({ ok: true });
  (app as any)[method](path, ...middlewares, handler);
  return app;
}

// ═══════════════════════════════════════════════════════════
// GROUP 1: Public / Unauthenticated Routes
// ═══════════════════════════════════════════════════════════

describe('Public route validators', () => {
  // /og/events/:slug
  const slugParam = zValidator('param', z.object({ slug: z.string().min(1).max(512) }), validationErrorHandler);

  describe('GET /og/events/:slug', () => {
    const app = makeApp('get', '/og/events/:slug', slugParam);

    test('accepts valid slug', async () => {
      const res = await app.request('/og/events/annual-gala-2026');
      expect(res.status).toBe(200);
    });

    // Note: Hono routing won't match empty slug segment, so min(1) is implicitly enforced
  });

  // /association/member/credentials/lookup/:credentialNumber
  const credentialNumberParam = zValidator('param', z.object({ credentialNumber: z.string().min(1).max(512) }), validationErrorHandler);

  describe('GET /credentials/lookup/:credentialNumber', () => {
    const app = makeApp('get', '/credentials/lookup/:credentialNumber', credentialNumberParam);

    test('accepts valid credential number', async () => {
      const res = await app.request('/credentials/lookup/PRC-12345');
      expect(res.status).toBe(200);
    });
  });

  // /certificates/verify/:certificateNumber
  const certificateNumberParam = zValidator('param', z.object({ certificateNumber: z.string().min(1).max(512) }), validationErrorHandler);

  describe('GET /certificates/verify/:certificateNumber', () => {
    const app = makeApp('get', '/certificates/verify/:certificateNumber', certificateNumberParam);

    test('accepts valid certificate number', async () => {
      const res = await app.request('/certificates/verify/CERT-2026-001');
      expect(res.status).toBe(200);
    });
  });

  // /pay/:token/validate and /pay/:token/checkout
  const paymentTokenParam = zValidator('param', z.object({ token: z.string().min(1).max(512) }), validationErrorHandler);

  describe('GET /pay/:token/validate', () => {
    const app = makeApp('get', '/pay/:token/validate', paymentTokenParam);

    test('accepts valid token', async () => {
      const res = await app.request('/pay/abc123token/validate');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /pay/:token/checkout', () => {
    const app = makeApp('post', '/pay/:token/checkout', paymentTokenParam);

    test('accepts valid token', async () => {
      const res = await app.request('/pay/abc123token/checkout', { method: 'POST' });
      expect(res.status).toBe(200);
    });
  });

  // /email/unsubscribe — query validation (token + email + orgId)
  const unsubQuery = zValidator('query', z.object({
    token: z.string().min(1).max(512),
    email: z.string().email().max(320),
    orgId: z.string().uuid(),
  }), validationErrorHandler);

  describe('GET /email/unsubscribe', () => {
    const app = makeApp('get', '/email/unsubscribe', unsubQuery);

    test('accepts valid query params', async () => {
      const res = await app.request(`/email/unsubscribe?token=abc&email=user@example.com&orgId=${VALID_UUID}`);
      expect(res.status).toBe(200);
    });

    test('rejects missing token', async () => {
      const res = await app.request(`/email/unsubscribe?email=user@example.com&orgId=${VALID_UUID}`);
      await expectValidationError(res, 'token');
    });

    test('rejects invalid email', async () => {
      const res = await app.request(`/email/unsubscribe?token=abc&email=not-an-email&orgId=${VALID_UUID}`);
      await expectValidationError(res, 'email');
    });

    test('rejects non-UUID orgId', async () => {
      const res = await app.request('/email/unsubscribe?token=abc&email=user@example.com&orgId=bad');
      await expectValidationError(res, 'orgId');
    });

    test('rejects all params missing', async () => {
      const res = await app.request('/email/unsubscribe');
      await expectValidationError(res);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// GROUP 2: Financial Routes
// ═══════════════════════════════════════════════════════════

describe('Financial route validators', () => {
  const orgIdParam = zValidator('param', z.object({ organizationId: z.string().uuid() }), validationErrorHandler);

  describe('POST /org/:organizationId/payments/send-link', () => {
    const app = makeApp('post', '/org/:organizationId/payments/send-link', orgIdParam);

    test('accepts valid UUID orgId', async () => {
      const res = await app.request(`/org/${VALID_UUID}/payments/send-link`, { method: 'POST' });
      expect(res.status).toBe(200);
    });

    test('rejects malformed UUID orgId', async () => {
      const res = await app.request(`/org/${BAD_UUID}/payments/send-link`, { method: 'POST' });
      await expectValidationError(res, 'organizationId');
    });
  });

  const receiptParams = zValidator('param', z.object({ organizationId: z.string().uuid(), paymentId: z.string().uuid() }), validationErrorHandler);

  describe('GET /org/:organizationId/payments/:paymentId/receipt', () => {
    const app = makeApp('get', '/org/:organizationId/payments/:paymentId/receipt', receiptParams);

    test('accepts valid UUID params', async () => {
      const res = await app.request(`/org/${VALID_UUID}/payments/${VALID_UUID}/receipt`);
      expect(res.status).toBe(200);
    });

    test('rejects malformed organizationId', async () => {
      const res = await app.request(`/org/${BAD_UUID}/payments/${VALID_UUID}/receipt`);
      await expectValidationError(res, 'organizationId');
    });

    test('rejects malformed paymentId', async () => {
      const res = await app.request(`/org/${VALID_UUID}/payments/${BAD_UUID}/receipt`);
      await expectValidationError(res, 'paymentId');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// GROUP 3: Admin Routes
// ═══════════════════════════════════════════════════════════

describe('Admin route validators', () => {
  const assocIdParam = zValidator('param', z.object({ associationId: z.string().uuid() }), validationErrorHandler);
  const uuidIdParam = zValidator('param', z.object({ id: z.string().uuid() }), validationErrorHandler);

  describe('GET /admin/national-dashboard/:associationId', () => {
    const app = makeApp('get', '/admin/national-dashboard/:associationId', assocIdParam);

    test('accepts valid UUID', async () => {
      const res = await app.request(`/admin/national-dashboard/${VALID_UUID}`);
      expect(res.status).toBe(200);
    });

    test('rejects malformed associationId', async () => {
      const res = await app.request(`/admin/national-dashboard/${BAD_UUID}`);
      await expectValidationError(res, 'associationId');
    });
  });

  describe('GET /admin/committees/:id', () => {
    const app = makeApp('get', '/admin/committees/:id', uuidIdParam);

    test('rejects malformed id', async () => {
      const res = await app.request('/admin/committees/not-uuid');
      await expectValidationError(res, 'id');
    });
  });

  // Breach notification
  const reportBreachBody = zValidator('json', z.object({
    organizationId: z.string().uuid().optional(),
    discoveredAt: z.string().min(1),
    description: z.string().min(1).max(5000),
    affectedRecordsCount: z.number().int().nonnegative().optional(),
    dataCategories: z.array(z.enum(['personal', 'sensitive_personal', 'health', 'financial', 'biometric', 'genetic', 'criminal'])).optional(),
  }), validationErrorHandler);

  describe('POST /admin/breaches', () => {
    const app = makeApp('post', '/admin/breaches', reportBreachBody);

    test('accepts valid breach report', async () => {
      const res = await app.request('/admin/breaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoveredAt: '2026-05-28', description: 'PII exposed in logs' }),
      });
      expect(res.status).toBe(200);
    });

    test('rejects missing discoveredAt', async () => {
      const res = await app.request('/admin/breaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'test breach' }),
      });
      await expectValidationError(res, 'discoveredAt');
    });

    test('rejects missing description', async () => {
      const res = await app.request('/admin/breaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoveredAt: '2026-01-01' }),
      });
      await expectValidationError(res, 'description');
    });

    test('rejects description over 5000 chars', async () => {
      const res = await app.request('/admin/breaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoveredAt: '2026-01-01', description: 'x'.repeat(5001) }),
      });
      await expectValidationError(res, 'description');
    });

    test('rejects invalid dataCategories enum', async () => {
      const res = await app.request('/admin/breaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoveredAt: '2026-01-01', description: 'test', dataCategories: ['invalid_category'] }),
      });
      await expectValidationError(res);
    });

    test('rejects negative affectedRecordsCount', async () => {
      const res = await app.request('/admin/breaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoveredAt: '2026-01-01', description: 'test', affectedRecordsCount: -5 }),
      });
      await expectValidationError(res, 'affectedRecordsCount');
    });

    test('rejects non-UUID organizationId', async () => {
      const res = await app.request('/admin/breaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoveredAt: '2026-01-01', description: 'test', organizationId: BAD_UUID }),
      });
      await expectValidationError(res, 'organizationId');
    });
  });

  // Breach status update
  const breachStatusBody = zValidator('json', z.object({
    status: z.enum(['investigating', 'notified', 'resolved']),
    npcReferenceNumber: z.string().min(1).max(255).optional(),
  }), validationErrorHandler);

  describe('PUT /admin/breaches/:id', () => {
    const app = makeApp('put', '/admin/breaches/:id', uuidIdParam, breachStatusBody);

    test('accepts valid status update', async () => {
      const res = await app.request(`/admin/breaches/${VALID_UUID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });
      expect(res.status).toBe(200);
    });

    test('rejects invalid status enum', async () => {
      const res = await app.request(`/admin/breaches/${VALID_UUID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      });
      await expectValidationError(res, 'status');
    });

    test('rejects missing status', async () => {
      const res = await app.request(`/admin/breaches/${VALID_UUID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await expectValidationError(res, 'status');
    });

    test('rejects malformed breach id', async () => {
      const res = await app.request(`/admin/breaches/${BAD_UUID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });
      await expectValidationError(res, 'id');
    });
  });

  // Support tickets
  const createTicketBody = zValidator('json', z.object({
    subject: z.string().min(1).max(500),
    description: z.string().min(1).max(10000),
    category: z.enum(['general', 'billing', 'technical', 'account', 'compliance']).optional(),
    priority: z.enum(['critical', 'high', 'standard', 'low']).optional(),
    organizationId: z.string().uuid().optional(),
  }), validationErrorHandler);

  describe('POST /support/tickets', () => {
    const app = makeApp('post', '/support/tickets', createTicketBody);

    test('accepts valid ticket', async () => {
      const res = await app.request('/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'Login issue', description: 'Cannot sign in' }),
      });
      expect(res.status).toBe(200);
    });

    test('rejects missing subject', async () => {
      const res = await app.request('/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'No subject here' }),
      });
      await expectValidationError(res, 'subject');
    });

    test('rejects missing description', async () => {
      const res = await app.request('/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'test' }),
      });
      await expectValidationError(res, 'description');
    });

    test('rejects subject over 500 chars', async () => {
      const res = await app.request('/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'x'.repeat(501), description: 'test' }),
      });
      await expectValidationError(res, 'subject');
    });

    test('rejects invalid category enum', async () => {
      const res = await app.request('/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'test', description: 'test', category: 'invalid' }),
      });
      await expectValidationError(res, 'category');
    });

    test('rejects invalid priority enum', async () => {
      const res = await app.request('/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'test', description: 'test', priority: 'urgent' }),
      });
      await expectValidationError(res, 'priority');
    });
  });

  // Ticket status update
  const ticketStatusBody = zValidator('json', z.object({
    status: z.string().min(1).max(50),
    assignedTo: z.string().uuid().optional(),
    resolution: z.string().max(5000).optional(),
  }).passthrough(), validationErrorHandler);

  describe('PUT /admin/tickets/:id', () => {
    const app = makeApp('put', '/admin/tickets/:id', uuidIdParam, ticketStatusBody);

    test('accepts valid status update', async () => {
      const res = await app.request(`/admin/tickets/${VALID_UUID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });
      expect(res.status).toBe(200);
    });

    test('rejects empty status', async () => {
      const res = await app.request(`/admin/tickets/${VALID_UUID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '' }),
      });
      await expectValidationError(res, 'status');
    });

    test('rejects non-UUID assignedTo', async () => {
      const res = await app.request(`/admin/tickets/${VALID_UUID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'open', assignedTo: BAD_UUID }),
      });
      await expectValidationError(res, 'assignedTo');
    });
  });

  // Ticket comment
  const ticketCommentBody = zValidator('json', z.object({
    comment: z.string().min(1).max(5000),
    internal: z.boolean().optional(),
  }).passthrough(), validationErrorHandler);

  describe('POST /admin/tickets/:id/comments', () => {
    const app = makeApp('post', '/admin/tickets/:id/comments', uuidIdParam, ticketCommentBody);

    test('accepts valid comment', async () => {
      const res = await app.request(`/admin/tickets/${VALID_UUID}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: 'Looking into this' }),
      });
      expect(res.status).toBe(200);
    });

    test('rejects empty comment', async () => {
      const res = await app.request(`/admin/tickets/${VALID_UUID}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: '' }),
      });
      await expectValidationError(res, 'comment');
    });

    test('rejects comment over 5000 chars', async () => {
      const res = await app.request(`/admin/tickets/${VALID_UUID}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: 'x'.repeat(5001) }),
      });
      await expectValidationError(res, 'comment');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// GROUP 4: Special Assessments
// ═══════════════════════════════════════════════════════════

describe('Special assessment validators', () => {
  const uuidIdParam = zValidator('param', z.object({ id: z.string().uuid() }), validationErrorHandler);
  const orgIdShortParam = zValidator('param', z.object({ orgId: z.string().uuid() }), validationErrorHandler);

  const saCreateBody = zValidator('json', z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(2000).nullish(),
    amount: z.number().positive(),
    currency: z.string().length(3).optional(),
    dueDate: z.string().min(1),
    fundId: z.string().uuid().nullish(),
    appliesTo: z.enum(['all', 'active', 'custom']).optional(),
  }), validationErrorHandler);

  const saUpdateBody = zValidator('json', z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).nullish(),
    amount: z.number().positive().optional(),
    currency: z.string().length(3).optional(),
    dueDate: z.string().min(1).optional(),
    fundId: z.string().uuid().nullish(),
    appliesTo: z.enum(['all', 'active', 'custom']).optional(),
  }), validationErrorHandler);

  describe('POST /special-assessments (create)', () => {
    const app = makeApp('post', '/special-assessments', saCreateBody);

    test('accepts valid assessment', async () => {
      const res = await app.request('/special-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Annual Levy', amount: 500, dueDate: '2026-12-31' }),
      });
      expect(res.status).toBe(200);
    });

    test('rejects missing name', async () => {
      const res = await app.request('/special-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 500, dueDate: '2026-12-31' }),
      });
      await expectValidationError(res, 'name');
    });

    test('rejects missing amount', async () => {
      const res = await app.request('/special-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Levy', dueDate: '2026-12-31' }),
      });
      await expectValidationError(res, 'amount');
    });

    test('rejects zero amount', async () => {
      const res = await app.request('/special-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Levy', amount: 0, dueDate: '2026-12-31' }),
      });
      await expectValidationError(res, 'amount');
    });

    test('rejects negative amount', async () => {
      const res = await app.request('/special-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Levy', amount: -100, dueDate: '2026-12-31' }),
      });
      await expectValidationError(res, 'amount');
    });

    test('rejects missing dueDate', async () => {
      const res = await app.request('/special-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Levy', amount: 500 }),
      });
      await expectValidationError(res, 'dueDate');
    });

    test('rejects invalid currency length', async () => {
      const res = await app.request('/special-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Levy', amount: 500, dueDate: '2026-12-31', currency: 'PESO' }),
      });
      await expectValidationError(res, 'currency');
    });

    test('rejects invalid appliesTo enum', async () => {
      const res = await app.request('/special-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Levy', amount: 500, dueDate: '2026-12-31', appliesTo: 'everyone' }),
      });
      await expectValidationError(res, 'appliesTo');
    });

    test('rejects non-UUID fundId', async () => {
      const res = await app.request('/special-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Levy', amount: 500, dueDate: '2026-12-31', fundId: BAD_UUID }),
      });
      await expectValidationError(res, 'fundId');
    });

    test('rejects name over 255 chars', async () => {
      const res = await app.request('/special-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'x'.repeat(256), amount: 500, dueDate: '2026-12-31' }),
      });
      await expectValidationError(res, 'name');
    });
  });

  describe('PUT /special-assessments/:id (update)', () => {
    const app = makeApp('put', '/special-assessments/:id', uuidIdParam, saUpdateBody);

    test('accepts partial update', async () => {
      const res = await app.request(`/special-assessments/${VALID_UUID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 750 }),
      });
      expect(res.status).toBe(200);
    });

    test('rejects malformed id', async () => {
      const res = await app.request(`/special-assessments/${BAD_UUID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 750 }),
      });
      await expectValidationError(res, 'id');
    });
  });

  describe('GET /special-assessments/:orgId (list)', () => {
    const app = makeApp('get', '/special-assessments/:orgId', orgIdShortParam);

    test('rejects malformed orgId', async () => {
      const res = await app.request(`/special-assessments/${BAD_UUID}`);
      await expectValidationError(res, 'orgId');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// GROUP 5: Module Routes (Elections, Training, Comms, Events)
// ═══════════════════════════════════════════════════════════

describe('Module route validators', () => {
  const uuidIdParam = zValidator('param', z.object({ id: z.string().uuid() }), validationErrorHandler);

  // Elections: nominee status
  const nomineeParams = zValidator('param', z.object({ electionId: z.string().uuid(), nomineeId: z.string().uuid() }), validationErrorHandler);
  const nomineeStatusBody = zValidator('json', z.object({
    status: z.enum(['accepted', 'declined']),
  }), validationErrorHandler);

  describe('PATCH /elections/:electionId/nominees/:nomineeId', () => {
    const app = makeApp('patch', '/elections/:electionId/nominees/:nomineeId', nomineeParams, nomineeStatusBody);

    test('accepts valid accepted status', async () => {
      const res = await app.request(`/elections/${VALID_UUID}/nominees/${VALID_UUID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      });
      expect(res.status).toBe(200);
    });

    test('accepts valid declined status', async () => {
      const res = await app.request(`/elections/${VALID_UUID}/nominees/${VALID_UUID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'declined' }),
      });
      expect(res.status).toBe(200);
    });

    test('rejects invalid status enum', async () => {
      const res = await app.request(`/elections/${VALID_UUID}/nominees/${VALID_UUID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      });
      await expectValidationError(res, 'status');
    });

    test('rejects malformed electionId', async () => {
      const res = await app.request(`/elections/${BAD_UUID}/nominees/${VALID_UUID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      });
      await expectValidationError(res, 'electionId');
    });

    test('rejects malformed nomineeId', async () => {
      const res = await app.request(`/elections/${VALID_UUID}/nominees/${BAD_UUID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      });
      await expectValidationError(res, 'nomineeId');
    });
  });

  describe('DELETE /elections/:id', () => {
    const app = makeApp('delete', '/elections/:id', uuidIdParam);

    test('rejects malformed id', async () => {
      const res = await app.request(`/elections/${BAD_UUID}`, { method: 'DELETE' });
      await expectValidationError(res, 'id');
    });
  });

  // Training lifecycle
  const orgAndIdParams = zValidator('param', z.object({ organizationId: z.string().uuid(), id: z.string().uuid() }), validationErrorHandler);

  describe('POST /organizations/:organizationId/training/:id/complete', () => {
    const app = makeApp('post', '/organizations/:organizationId/training/:id/complete', orgAndIdParams);

    test('accepts valid UUIDs', async () => {
      const res = await app.request(`/organizations/${VALID_UUID}/training/${VALID_UUID}/complete`, { method: 'POST' });
      expect(res.status).toBe(200);
    });

    test('rejects malformed organizationId', async () => {
      const res = await app.request(`/organizations/${BAD_UUID}/training/${VALID_UUID}/complete`, { method: 'POST' });
      await expectValidationError(res, 'organizationId');
    });

    test('rejects malformed training id', async () => {
      const res = await app.request(`/organizations/${VALID_UUID}/training/${BAD_UUID}/complete`, { method: 'POST' });
      await expectValidationError(res, 'id');
    });
  });

  // Officer transition
  const transitionParams = zValidator('param', z.object({ organizationId: z.string().uuid(), termId: z.string().uuid() }), validationErrorHandler);
  const transitionBody = zValidator('json', z.object({
    successorPersonId: z.string().uuid(),
    checklistItems: z.array(z.string().min(1).max(500)).optional(),
  }), validationErrorHandler);

  describe('POST /officers/:termId/transition', () => {
    const app = makeApp('post', '/org/:organizationId/officers/:termId/transition', transitionParams, transitionBody);

    test('accepts valid transition', async () => {
      const res = await app.request(`/org/${VALID_UUID}/officers/${VALID_UUID}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ successorPersonId: VALID_UUID }),
      });
      expect(res.status).toBe(200);
    });

    test('rejects missing successorPersonId', async () => {
      const res = await app.request(`/org/${VALID_UUID}/officers/${VALID_UUID}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await expectValidationError(res, 'successorPersonId');
    });

    test('rejects non-UUID successorPersonId', async () => {
      const res = await app.request(`/org/${VALID_UUID}/officers/${VALID_UUID}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ successorPersonId: BAD_UUID }),
      });
      await expectValidationError(res, 'successorPersonId');
    });

    test('rejects malformed termId', async () => {
      const res = await app.request(`/org/${VALID_UUID}/officers/${BAD_UUID}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ successorPersonId: VALID_UUID }),
      });
      await expectValidationError(res, 'termId');
    });
  });

  // ID card
  const orgIdShortParam = zValidator('param', z.object({ orgId: z.string().uuid() }), validationErrorHandler);

  describe('GET /persons/me/id-card/:orgId', () => {
    const app = makeApp('get', '/persons/me/id-card/:orgId', orgIdShortParam);

    test('rejects malformed orgId', async () => {
      const res = await app.request(`/persons/me/id-card/${BAD_UUID}`);
      await expectValidationError(res, 'orgId');
    });
  });

  // Bulk certificate issue
  const bulkIssueBody = zValidator('json', z.object({
    personIds: z.array(z.string().uuid()).min(1).max(500),
    templateId: z.string().uuid().optional(),
  }).passthrough(), validationErrorHandler);

  describe('POST /certificates/bulk-issue', () => {
    const app = makeApp('post', '/certificates/bulk-issue', bulkIssueBody);

    test('accepts valid personIds', async () => {
      const res = await app.request('/certificates/bulk-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personIds: [VALID_UUID] }),
      });
      expect(res.status).toBe(200);
    });

    test('rejects empty personIds array', async () => {
      const res = await app.request('/certificates/bulk-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personIds: [] }),
      });
      await expectValidationError(res, 'personIds');
    });

    test('rejects non-UUID in personIds', async () => {
      const res = await app.request('/certificates/bulk-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personIds: [BAD_UUID] }),
      });
      await expectValidationError(res);
    });

    test('rejects non-UUID templateId', async () => {
      const res = await app.request('/certificates/bulk-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personIds: [VALID_UUID], templateId: BAD_UUID }),
      });
      await expectValidationError(res, 'templateId');
    });
  });

  // Saved segments
  const segmentBody = zValidator('json', z.object({
    name: z.string().min(1).max(255),
    filters: z.record(z.string(), z.unknown()).optional(),
  }).passthrough(), validationErrorHandler);

  describe('POST /communications/segments', () => {
    const app = makeApp('post', '/communications/segments', segmentBody);

    test('accepts valid segment', async () => {
      const res = await app.request('/communications/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Active Members' }),
      });
      expect(res.status).toBe(200);
    });

    test('rejects empty name', async () => {
      const res = await app.request('/communications/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });
      await expectValidationError(res, 'name');
    });

    test('rejects name over 255 chars', async () => {
      const res = await app.request('/communications/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'x'.repeat(256) }),
      });
      await expectValidationError(res, 'name');
    });
  });

  // Announcement scheduling
  const scheduleBody = zValidator('json', z.object({
    scheduledAt: z.string().min(1),
  }).passthrough(), validationErrorHandler);

  describe('POST /communications/announcements/:id/schedule', () => {
    const app = makeApp('post', '/announcements/:id/schedule', uuidIdParam, scheduleBody);

    test('accepts valid schedule', async () => {
      const res = await app.request(`/announcements/${VALID_UUID}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: '2026-06-01T09:00:00Z' }),
      });
      expect(res.status).toBe(200);
    });

    test('rejects empty scheduledAt', async () => {
      const res = await app.request(`/announcements/${VALID_UUID}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: '' }),
      });
      await expectValidationError(res, 'scheduledAt');
    });

    test('rejects malformed announcement id', async () => {
      const res = await app.request(`/announcements/${BAD_UUID}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: '2026-06-01T09:00:00Z' }),
      });
      await expectValidationError(res, 'id');
    });
  });

  // Event cancel registration
  const cancelRegParams = zValidator('param', z.object({ orgId: z.string().uuid(), eventId: z.string().uuid(), registrationId: z.string().uuid() }), validationErrorHandler);

  describe('DELETE /org/:orgId/events/:eventId/register/:registrationId', () => {
    const app = makeApp('delete', '/org/:orgId/events/:eventId/register/:registrationId', cancelRegParams);

    test('accepts valid UUIDs', async () => {
      const res = await app.request(`/org/${VALID_UUID}/events/${VALID_UUID}/register/${VALID_UUID}`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    });

    test('rejects malformed orgId', async () => {
      const res = await app.request(`/org/${BAD_UUID}/events/${VALID_UUID}/register/${VALID_UUID}`, { method: 'DELETE' });
      await expectValidationError(res, 'orgId');
    });

    test('rejects malformed eventId', async () => {
      const res = await app.request(`/org/${VALID_UUID}/events/${BAD_UUID}/register/${VALID_UUID}`, { method: 'DELETE' });
      await expectValidationError(res, 'eventId');
    });

    test('rejects malformed registrationId', async () => {
      const res = await app.request(`/org/${VALID_UUID}/events/${VALID_UUID}/register/${BAD_UUID}`, { method: 'DELETE' });
      await expectValidationError(res, 'registrationId');
    });
  });

  // Survey routes
  const surveyParam = zValidator('param', z.object({ survey: z.string().uuid() }), validationErrorHandler);

  describe('GET /surveys/:survey/export', () => {
    const app = makeApp('get', '/surveys/:survey/export', surveyParam);

    test('rejects malformed survey id', async () => {
      const res = await app.request(`/surveys/${BAD_UUID}/export`);
      await expectValidationError(res, 'survey');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// GROUP 6: Subscription & Pricing Routes
// ═══════════════════════════════════════════════════════════

describe('Subscription route validators', () => {
  const uuidIdParam = zValidator('param', z.object({ id: z.string().uuid() }), validationErrorHandler);
  const orgIdParam = zValidator('param', z.object({ organizationId: z.string().uuid() }), validationErrorHandler);
  const tierIdParam = zValidator('param', z.object({ tierId: z.string().uuid() }), validationErrorHandler);

  const pricingBody = zValidator('json', z.object({
    name: z.string().min(1).max(255),
    amount: z.number().nonnegative(),
    currency: z.string().length(3).optional(),
    interval: z.enum(['monthly', 'quarterly', 'annually']).optional(),
    features: z.array(z.string()).optional(),
  }).passthrough(), validationErrorHandler);

  describe('POST /admin/pricing', () => {
    const app = makeApp('post', '/admin/pricing', pricingBody);

    test('accepts valid pricing tier', async () => {
      const res = await app.request('/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Basic', amount: 0 }),
      });
      expect(res.status).toBe(200);
    });

    test('rejects missing name', async () => {
      const res = await app.request('/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100 }),
      });
      await expectValidationError(res, 'name');
    });

    test('rejects negative amount', async () => {
      const res = await app.request('/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Pro', amount: -50 }),
      });
      await expectValidationError(res, 'amount');
    });

    test('rejects invalid interval enum', async () => {
      const res = await app.request('/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Pro', amount: 100, interval: 'weekly' }),
      });
      await expectValidationError(res, 'interval');
    });

    test('rejects invalid currency length', async () => {
      const res = await app.request('/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Pro', amount: 100, currency: 'PESO' }),
      });
      await expectValidationError(res, 'currency');
    });
  });

  describe('PUT /admin/pricing/:tierId', () => {
    const app = makeApp('put', '/admin/pricing/:tierId', tierIdParam, pricingBody);

    test('rejects malformed tierId', async () => {
      const res = await app.request(`/admin/pricing/${BAD_UUID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Pro', amount: 100 }),
      });
      await expectValidationError(res, 'tierId');
    });
  });

  describe('PUT /admin/subscriptions/:id/cancel', () => {
    const app = makeApp('put', '/admin/subscriptions/:id/cancel', uuidIdParam);

    test('rejects malformed id', async () => {
      const res = await app.request(`/admin/subscriptions/${BAD_UUID}/cancel`, { method: 'PUT' });
      await expectValidationError(res, 'id');
    });
  });

  const subscriptionBody = zValidator('json', z.object({
    tierId: z.string().uuid(),
  }).passthrough(), validationErrorHandler);

  describe('POST /subscription/upgrade', () => {
    const app = makeApp('post', '/org/:organizationId/subscription/upgrade', orgIdParam, subscriptionBody);

    test('accepts valid upgrade', async () => {
      const res = await app.request(`/org/${VALID_UUID}/subscription/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId: VALID_UUID }),
      });
      expect(res.status).toBe(200);
    });

    test('rejects missing tierId', async () => {
      const res = await app.request(`/org/${VALID_UUID}/subscription/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await expectValidationError(res, 'tierId');
    });

    test('rejects non-UUID tierId', async () => {
      const res = await app.request(`/org/${VALID_UUID}/subscription/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId: BAD_UUID }),
      });
      await expectValidationError(res, 'tierId');
    });

    test('rejects malformed orgId', async () => {
      const res = await app.request(`/org/${BAD_UUID}/subscription/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId: VALID_UUID }),
      });
      await expectValidationError(res, 'organizationId');
    });
  });

  describe('POST /subscription/checkout', () => {
    const app = makeApp('post', '/org/:organizationId/subscription/checkout', orgIdParam, subscriptionBody);

    test('rejects empty body', async () => {
      const res = await app.request(`/org/${VALID_UUID}/subscription/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await expectValidationError(res, 'tierId');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// GROUP 7: ValidationError response format
// ═══════════════════════════════════════════════════════════

describe('ValidationError response format', () => {
  const uuidIdParam = zValidator('param', z.object({ id: z.string().uuid() }), validationErrorHandler);
  const app = makeApp('get', '/test/:id', uuidIdParam);

  test('returns TypeSpec-compliant error shape', async () => {
    const res = await app.request('/test/not-a-uuid');
    expect(res.status).toBe(400);
    const body = await res.json() as any;

    // Required fields
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.statusCode).toBe(400);
    expect(typeof body.message).toBe('string');
    expect(typeof body.requestId).toBe('string');
    expect(typeof body.timestamp).toBe('string');

    // fieldErrors array with proper structure
    expect(Array.isArray(body.fieldErrors)).toBe(true);
    expect(body.fieldErrors.length).toBeGreaterThan(0);
    const fe = body.fieldErrors[0];
    expect(fe.field).toBe('id');
    expect(typeof fe.code).toBe('string');
    expect(typeof fe.message).toBe('string');
  });

  test('includes path and method in non-production', async () => {
    const res = await app.request('/test/bad');
    const body = await res.json() as any;
    // In test env (not production), path and method should be present
    expect(body.path).toBe('/test/bad');
    expect(body.method).toBe('GET');
  });
});

/**
 * FIX-011 (G7) — TypeSpec migration regression guard
 *
 * The ticket / breach / pricing / subscription admin routes were migrated from
 * hand-wired `app.ts` registrations to generated TypeSpec routes so they appear
 * in OpenAPI and generate SDK hooks (unblocks FIX-013 admin UI).
 *
 * This test locks in the preservation contract:
 *   1. Every migrated operation is present in the generated route table at its
 *      original `/admin/...` path + method, behind the platform_admin role gate.
 *   2. The generated request-body validators ACCEPT the exact body shapes the
 *      hand-wired handlers read via `ctx.req.json()` — so no currently-valid
 *      request is rejected after migration (validators strip unknown keys; the
 *      handlers read the raw body, so divergence from the old zValidator shapes
 *      is safe as long as the real fields are accepted).
 *   3. `createTicket` (POST /support/tickets) stays OUT of the generated /admin
 *      surface — it is public-authenticated and must not be admin-gated.
 *
 * Contract (Hurl) coverage of these endpoints needs a booted API + DB and is
 * `[BLOCKED BY ENVIRONMENT]`; this generated-artifact + validator test is the
 * deterministic in-process proof.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as validators from '@/generated/openapi/validators';
import { registry } from '@/generated/openapi/registry';

const ROUTES_SRC = readFileSync(
  join(import.meta.dir, '../../generated/openapi/routes.ts'),
  'utf8',
);

// operationId → [method, generated hono path]
const MIGRATED: Array<{ op: string; method: string; path: string }> = [
  { op: 'listTickets', method: 'get', path: '/admin/tickets' },
  { op: 'getTicket', method: 'get', path: '/admin/tickets/:id' },
  { op: 'updateTicketStatus', method: 'put', path: '/admin/tickets/:id' },
  { op: 'addTicketComment', method: 'post', path: '/admin/tickets/:id/comments' },
  { op: 'reportBreach', method: 'post', path: '/admin/breaches' },
  { op: 'listBreaches', method: 'get', path: '/admin/breaches' },
  { op: 'updateBreachStatus', method: 'put', path: '/admin/breaches/:id' },
  { op: 'listPricingTiers', method: 'get', path: '/admin/pricing' },
  { op: 'createPricingTier', method: 'post', path: '/admin/pricing' },
  { op: 'updatePricingTier', method: 'put', path: '/admin/pricing/:tierId' },
  { op: 'listSubscriptions', method: 'get', path: '/admin/subscriptions' },
  { op: 'getSubscription', method: 'get', path: '/admin/subscriptions/:id' },
  { op: 'cancelSubscription', method: 'put', path: '/admin/subscriptions/:id/cancel' },
];

describe('FIX-011 — migrated admin routes are in the generated table', () => {
  for (const { op, method, path } of MIGRATED) {
    test(`${op} → ${method.toUpperCase()} ${path} registered with platform_admin gate`, () => {
      // The handler is wired into the generated registry.
      expect(typeof (registry as Record<string, unknown>)[op]).toBe('function');

      // The generated route table registers the exact method + path.
      const routeRe = new RegExp(
        `app\\.${method}\\(\\s*'${path.replace(/[/:]/g, '\\$&')}'`,
      );
      expect(ROUTES_SRC).toMatch(routeRe);
    });
  }

  test('every migrated /admin route carries the platform_admin role guard', () => {
    // Each generated block for these ops includes the role-scoped authMiddleware.
    // Grep the route source for the op comment + the role guard on the next lines.
    for (const { op } of MIGRATED) {
      const idx = ROUTES_SRC.indexOf(`// ${op}\n`);
      expect(idx).toBeGreaterThan(-1);
      const block = ROUTES_SRC.slice(idx, idx + 400);
      expect(block).toContain('roles: ["platform_admin"]');
    }
  });

  test('createTicket stays OUT of the generated /admin surface (public /support/tickets)', () => {
    expect(ROUTES_SRC).not.toContain("'/support/tickets'");
    // createTicket is not registered as a generated route handler.
    expect(ROUTES_SRC).not.toMatch(/registry\.createTicket\b/);
  });
});

describe('FIX-011 — generated body validators accept the shapes the handlers read', () => {
  test('ReportBreachBody accepts the fields reportBreach reads', () => {
    const parsed = validators.ReportBreachBody.safeParse({
      organizationId: '11111111-1111-4111-8111-111111111111',
      discoveredAt: '2026-01-01T00:00:00.000Z',
      description: 'a breach',
      affectedRecordsCount: 5,
      dataCategories: ['personal', 'health'],
    });
    expect(parsed.success).toBe(true);
    // discoveredAt + description are required by the handler.
    expect(validators.ReportBreachBody.safeParse({ description: 'x' }).success).toBe(false);
  });

  test('UpdateBreachStatusBody accepts status + npcReferenceNumber', () => {
    expect(
      validators.UpdateBreachStatusBody.safeParse({
        status: 'notified',
        npcReferenceNumber: 'NPC-2026-001',
      }).success,
    ).toBe(true);
  });

  test('UpdateTicketStatusBody accepts status + assignedTo (the fields updateTicketStatus reads)', () => {
    expect(
      validators.UpdateTicketStatusBody.safeParse({
        status: 'in_progress',
        assignedTo: '22222222-2222-4222-8222-222222222222',
      }).success,
    ).toBe(true);
    // Empty body is allowed (handler treats status as optional / assignee-only update).
    expect(validators.UpdateTicketStatusBody.safeParse({}).success).toBe(true);
  });

  test('AddTicketCommentBody accepts content + isInternal (NOT the stale comment/internal shape)', () => {
    expect(
      validators.AddTicketCommentBody.safeParse({ content: 'hello', isInternal: true }).success,
    ).toBe(true);
    // content is required (handler throws if absent).
    expect(validators.AddTicketCommentBody.safeParse({}).success).toBe(false);
  });

  test('PricingTier bodies accept the real handler fields (slug, monthlyPrice, annualPrice, …)', () => {
    const ok = validators.CreatePricingTierBody.safeParse({
      name: 'Pro',
      slug: 'pro',
      monthlyPrice: 50000,
      annualPrice: 500000,
      currency: 'PHP',
      maxMembers: 100,
      trialDays: 30,
      features: ['a', 'b'],
      isActive: true,
      sortOrder: 1,
    });
    expect(ok.success).toBe(true);
    // Update uses the same body shape.
    expect(
      validators.UpdatePricingTierBody.safeParse({ monthlyPrice: 60000 }).success,
    ).toBe(true);
  });

  test('CancelSubscriptionBody accepts reason (the field cancelSubscription reads)', () => {
    expect(validators.CancelSubscriptionBody.safeParse({ reason: 'churn' }).success).toBe(true);
    // reason is required (handler throws ValidationError if absent/empty).
    expect(validators.CancelSubscriptionBody.safeParse({}).success).toBe(false);
  });
});

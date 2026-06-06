/**
 * Tests for per-route audit middleware (P1.5).
 *
 * Same makeCtx / runMiddleware pattern as audit.test.ts.
 */

import { describe, it, expect, mock } from 'bun:test';
import { createPerRouteAuditMiddleware, type PerRouteAuditMeta } from '@/middleware/per-route-audit';

// Mock-Classification: APPROPRIATE — audit logging infrastructure boundary
// Assertion-Style: BEHAVIOR_CHECK — verifying composed audit event shape

function makeLogEvent(opts?: { throw?: boolean }) {
  if (opts?.throw) {
    return mock(async () => { throw new Error('logEvent failed'); });
  }
  return mock(async (_req: unknown) => ({}));
}

function makeAudit(logEventFn = makeLogEvent()) {
  return { logEvent: logEventFn };
}

function makeCtx(overrides: {
  method?: string;
  path?: string;
  status?: number;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  audit?: object | null | undefined;
  user?: object | null | undefined;
  organizationId?: string;
  preset?: Record<string, unknown>; // ctx.set values populated by handler
}) {
  const method = overrides.method ?? 'POST';
  const path = overrides.path ?? '/x/abc';
  const status = overrides.status ?? 200;
  const headers: Record<string, string> = overrides.headers ?? {};
  const params: Record<string, string> = overrides.params ?? {};

  const stored: Record<string, unknown> = {
    audit: overrides.audit !== undefined ? overrides.audit : makeAudit(),
    user: overrides.user !== undefined ? overrides.user : { id: 'user-1' },
    organizationId: overrides.organizationId,
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    ...(overrides.preset ?? {}),
  };

  const ctx = {
    req: {
      method,
      url: `http://localhost${path}`,
      header: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? undefined,
      param: (key?: string) => (key ? params[key] : params),
    },
    res: { status },
    get: (key: string) => stored[key],
    set: (key: string, value: unknown) => { stored[key] = value; },
    _stored: stored,
  };

  return ctx as any;
}

async function runMiddleware(
  ctx: any,
  meta: PerRouteAuditMeta,
  nextImpl?: () => Promise<void>,
): Promise<{ nextCalled: boolean; error: Error | null }> {
  const middleware = createPerRouteAuditMiddleware(meta);
  let nextCalled = false;
  let error: Error | null = null;

  const next = mock(async () => {
    nextCalled = true;
    if (nextImpl) await nextImpl();
  });

  try {
    await middleware(ctx, next);
  } catch (e) {
    error = e as Error;
  }

  return { nextCalled, error };
}

describe('createPerRouteAuditMiddleware', () => {
  it('returns a function (middleware)', () => {
    expect(typeof createPerRouteAuditMiddleware({ action: 'create', resourceType: 'x' })).toBe('function');
  });

  it('emits typed event on 2xx with static metadata + ctx-driven dynamic fields', async () => {
    const logEvent = makeLogEvent();
    const ctx = makeCtx({
      method: 'PUT',
      path: '/onboarding/step',
      status: 200,
      audit: makeAudit(logEvent),
      organizationId: 'org-7',
      preset: {
        auditResourceId: 'state-42',
        auditDescription: 'Onboarding step 3 saved for organization org-7',
        auditDetails: { step: 3 },
      },
    });

    await runMiddleware(ctx, {
      action: 'update',
      resourceType: 'onboarding_state',
      eventSubType: 'membership.member-added',
    });

    expect(logEvent).toHaveBeenCalledTimes(1);
    const [req] = logEvent.mock.calls[0] as [Record<string, unknown>];
    expect(req.action).toBe('update');
    expect(req.resourceType).toBe('onboarding_state');
    expect(req.resource).toBe('state-42');
    expect(req.eventSubType).toBe('membership.member-added');
    expect(req.outcome).toBe('success');
    expect(req.description).toBe('Onboarding step 3 saved for organization org-7');
    expect(req.details).toEqual({ step: 3 });
    expect(req.organizationId).toBe('org-7');
    expect(req.user).toBe('user-1');
  });

  it('falls back to first path param when ctx.auditResourceId unset', async () => {
    const logEvent = makeLogEvent();
    const ctx = makeCtx({
      method: 'DELETE',
      path: '/docs/doc-9',
      status: 200,
      audit: makeAudit(logEvent),
      params: { documentId: 'doc-9' },
    });

    await runMiddleware(ctx, { action: 'delete', resourceType: 'document' });

    const [req] = logEvent.mock.calls[0] as [Record<string, unknown>];
    expect(req.resource).toBe('doc-9');
  });

  it('falls back to computed description when ctx.auditDescription unset', async () => {
    const logEvent = makeLogEvent();
    const ctx = makeCtx({
      method: 'POST',
      path: '/x/abc',
      status: 201,
      audit: makeAudit(logEvent),
      preset: { auditResourceId: 'res-1' },
    });

    await runMiddleware(ctx, { action: 'create', resourceType: 'thing' });

    const [req] = logEvent.mock.calls[0] as [Record<string, unknown>];
    expect(req.description).toBe('create thing res-1');
  });

  it('skips logging when response status >= 400', async () => {
    const logEvent = makeLogEvent();
    const ctx = makeCtx({ method: 'POST', status: 422, audit: makeAudit(logEvent) });
    await runMiddleware(ctx, { action: 'create', resourceType: 'x' });
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('does not throw when audit service logEvent rejects', async () => {
    const logEvent = makeLogEvent({ throw: true });
    const ctx = makeCtx({ method: 'POST', status: 201, audit: makeAudit(logEvent) });
    const { error } = await runMiddleware(ctx, { action: 'create', resourceType: 'x' });
    expect(error).toBeNull();
    expect(logEvent).toHaveBeenCalledTimes(1);
  });

  it('no-op when ctx.audit is missing', async () => {
    const ctx = makeCtx({ method: 'POST', status: 201, audit: null });
    const { error } = await runMiddleware(ctx, { action: 'create', resourceType: 'x' });
    expect(error).toBeNull();
  });

  it('passes ip + user-agent headers through', async () => {
    const logEvent = makeLogEvent();
    const ctx = makeCtx({
      method: 'POST',
      status: 201,
      audit: makeAudit(logEvent),
      headers: { 'x-forwarded-for': '203.0.113.7', 'user-agent': 'caveman/1.0' },
    });
    await runMiddleware(ctx, { action: 'create', resourceType: 'x' });
    const [req] = logEvent.mock.calls[0] as [Record<string, unknown>];
    expect(req.ipAddress).toBe('203.0.113.7');
    expect(req.userAgent).toBe('caveman/1.0');
  });

  it('uses eventType override when supplied (data-access for reads)', async () => {
    const logEvent = makeLogEvent();
    const ctx = makeCtx({ method: 'GET', status: 200, audit: makeAudit(logEvent) });
    await runMiddleware(ctx, { action: 'read', resourceType: 'document', eventType: 'data-access' });
    const [req] = logEvent.mock.calls[0] as [Record<string, unknown>];
    expect(req.eventType).toBe('data-access');
  });

  describe('multi-event mode (ctx.set auditEvents)', () => {
    it('emits one log per entry when handler sets auditEvents array', async () => {
      const logEvent = makeLogEvent();
      const ctx = makeCtx({
        method: 'POST',
        status: 201,
        audit: makeAudit(logEvent),
        preset: {
          auditEvents: [
            {
              action: 'complete',
              resourceType: 'invitation',
              resource: 'inv-1',
              description: 'Invitation claimed',
            },
            {
              action: 'create',
              resourceType: 'membership',
              resource: 'mem-1',
              description: 'Membership created via invite claim',
              details: { source: 'invite' },
            },
          ],
        },
      });

      await runMiddleware(ctx, { action: 'create', resourceType: 'invitation' });

      expect(logEvent).toHaveBeenCalledTimes(2);
      const first = (logEvent.mock.calls[0] as [Record<string, unknown>])[0];
      const second = (logEvent.mock.calls[1] as [Record<string, unknown>])[0];
      expect(first.action).toBe('complete');
      expect(first.resource).toBe('inv-1');
      expect(second.action).toBe('create');
      expect(second.resourceType).toBe('membership');
      expect(second.details).toEqual({ source: 'invite' });
    });

    it('multi-event entries inherit category + ip + ua from request context', async () => {
      const logEvent = makeLogEvent();
      const ctx = makeCtx({
        method: 'POST',
        status: 201,
        audit: makeAudit(logEvent),
        headers: { 'x-forwarded-for': '198.51.100.1', 'user-agent': 'mw-test/1.0' },
        preset: {
          auditEvents: [
            { action: 'create', resourceType: 'a', resource: 'a-1' },
          ],
        },
      });

      await runMiddleware(ctx, { action: 'create', resourceType: 'x' });

      const [req] = logEvent.mock.calls[0] as [Record<string, unknown>];
      expect(req.ipAddress).toBe('198.51.100.1');
      expect(req.userAgent).toBe('mw-test/1.0');
      expect(req.user).toBe('user-1');
      expect(req.outcome).toBe('success');
    });

    it('empty auditEvents array suppresses logging (no fallback)', async () => {
      const logEvent = makeLogEvent();
      const ctx = makeCtx({
        method: 'POST',
        status: 201,
        audit: makeAudit(logEvent),
        preset: { auditEvents: [] },
      });
      await runMiddleware(ctx, { action: 'create', resourceType: 'x' });
      expect(logEvent).not.toHaveBeenCalled();
    });

    it('multi-event mode skips when response status >= 400', async () => {
      const logEvent = makeLogEvent();
      const ctx = makeCtx({
        method: 'POST',
        status: 422,
        audit: makeAudit(logEvent),
        preset: {
          auditEvents: [{ action: 'create', resourceType: 'x', resource: 'x-1' }],
        },
      });
      await runMiddleware(ctx, { action: 'create', resourceType: 'x' });
      expect(logEvent).not.toHaveBeenCalled();
    });
  });
});

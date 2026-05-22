/**
 * Tests for the global audit middleware.
 *
 * Uses the same makeCtx / runMiddleware pattern as auth.test.ts.
 * All assertions treat the middleware as a pure unit — no real DB or audit service.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { createAuditMiddleware } from '@/middleware/audit';

// Mock-Classification: APPROPRIATE — audit logging infrastructure boundary
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogEvent(overrides?: Partial<{ throw: boolean }>) {
  if (overrides?.throw) {
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
  audit?: object | null | undefined;
  user?: object | null | undefined;
  logger?: object | null | undefined;
}) {
  const method = overrides.method ?? 'POST';
  const path = overrides.path ?? '/persons/abc-123';
  const status = overrides.status ?? 200;
  const headers: Record<string, string> = overrides.headers ?? {};

  const stored: Record<string, unknown> = {
    audit: overrides.audit !== undefined ? overrides.audit : makeAudit(),
    user: overrides.user !== undefined ? overrides.user : null,
    logger: overrides.logger !== undefined
      ? overrides.logger
      : {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
        },
  };

  const ctx = {
    req: {
      method,
      url: `http://localhost${path}`,
      header: (name: string) =>
        headers[name] ?? headers[name.toLowerCase()] ?? undefined,
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
  nextImpl?: () => Promise<void>,
): Promise<{ nextCalled: boolean; error: Error | null }> {
  const middleware = createAuditMiddleware();
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createAuditMiddleware', () => {
  describe('factory', () => {
    it('returns a function (middleware)', () => {
      const mw = createAuditMiddleware();
      expect(typeof mw).toBe('function');
    });
  });

  describe('method filtering', () => {
    it('skips GET requests — logEvent not called', async () => {
      const logEvent = makeLogEvent();
      const audit = makeAudit(logEvent);
      const ctx = makeCtx({ method: 'GET', audit });
      await runMiddleware(ctx);
      expect(logEvent).not.toHaveBeenCalled();
    });

    it('skips HEAD requests — logEvent not called', async () => {
      const logEvent = makeLogEvent();
      const audit = makeAudit(logEvent);
      const ctx = makeCtx({ method: 'HEAD', audit });
      await runMiddleware(ctx);
      expect(logEvent).not.toHaveBeenCalled();
    });

    it('skips OPTIONS requests — logEvent not called', async () => {
      const logEvent = makeLogEvent();
      const audit = makeAudit(logEvent);
      const ctx = makeCtx({ method: 'OPTIONS', audit });
      await runMiddleware(ctx);
      expect(logEvent).not.toHaveBeenCalled();
    });
  });

  describe('action mapping', () => {
    it('logs create action for POST with resourceType and resource', async () => {
      const logEvent = makeLogEvent();
      const audit = makeAudit(logEvent);
      const ctx = makeCtx({ method: 'POST', path: '/persons/abc-123', status: 201, audit });

      await runMiddleware(ctx);

      expect(logEvent).toHaveBeenCalledTimes(1);
      const [req] = logEvent.mock.calls[0] as [Record<string, unknown>];
      expect(req.action).toBe('create');
      expect(req.resourceType).toBe('persons');
      expect(req.resource).toBe('abc-123');
      expect(req.outcome).toBe('success');
    });

    it('logs update action for PATCH with nested path segment as resourceId', async () => {
      const logEvent = makeLogEvent();
      const audit = makeAudit(logEvent);
      const ctx = makeCtx({ method: 'PATCH', path: '/membership/members/xyz', status: 200, audit });

      await runMiddleware(ctx);

      expect(logEvent).toHaveBeenCalledTimes(1);
      const [req] = logEvent.mock.calls[0] as [Record<string, unknown>];
      expect(req.action).toBe('update');
      expect(req.resourceType).toBe('membership');
      expect(req.resource).toBe('members');
    });

    it('logs update action for PUT', async () => {
      const logEvent = makeLogEvent();
      const audit = makeAudit(logEvent);
      const ctx = makeCtx({ method: 'PUT', path: '/dues/d1', status: 200, audit });

      await runMiddleware(ctx);

      const [req] = logEvent.mock.calls[0] as [Record<string, unknown>];
      expect(req.action).toBe('update');
    });

    it('logs delete action for DELETE', async () => {
      const logEvent = makeLogEvent();
      const audit = makeAudit(logEvent);
      const ctx = makeCtx({ method: 'DELETE', path: '/booking/slots/s1', status: 204, audit });

      await runMiddleware(ctx);

      expect(logEvent).toHaveBeenCalledTimes(1);
      const [req] = logEvent.mock.calls[0] as [Record<string, unknown>];
      expect(req.action).toBe('delete');
    });
  });

  describe('outcome mapping', () => {
    it('logs success outcome for 2xx status', async () => {
      const logEvent = makeLogEvent();
      const audit = makeAudit(logEvent);
      const ctx = makeCtx({ method: 'POST', path: '/persons', status: 201, audit });

      await runMiddleware(ctx);

      const [req] = logEvent.mock.calls[0] as [Record<string, unknown>];
      expect(req.outcome).toBe('success');
    });

    it('logs failure outcome for 4xx status', async () => {
      const logEvent = makeLogEvent();
      const audit = makeAudit(logEvent);
      const ctx = makeCtx({ method: 'POST', path: '/persons', status: 400, audit });

      await runMiddleware(ctx);

      const [req] = logEvent.mock.calls[0] as [Record<string, unknown>];
      expect(req.outcome).toBe('failure');
    });

    it('logs failure outcome for 5xx status', async () => {
      const logEvent = makeLogEvent();
      const audit = makeAudit(logEvent);
      const ctx = makeCtx({ method: 'POST', path: '/persons', status: 500, audit });

      await runMiddleware(ctx);

      const [req] = logEvent.mock.calls[0] as [Record<string, unknown>];
      expect(req.outcome).toBe('failure');
    });
  });

  describe('non-blocking error handling', () => {
    it('does not throw when logEvent rejects', async () => {
      const logEvent = makeLogEvent({ throw: true });
      const audit = makeAudit(logEvent);
      const ctx = makeCtx({ method: 'POST', path: '/persons', status: 201, audit });

      const { error } = await runMiddleware(ctx);
      expect(error).toBeNull();
    });

    it('does not throw when audit service is undefined in context', async () => {
      const ctx = makeCtx({ method: 'POST', path: '/persons', status: 201, audit: undefined });

      const { error } = await runMiddleware(ctx);
      expect(error).toBeNull();
    });
  });

  describe('next() behavior', () => {
    it('calls next() exactly once', async () => {
      const logEvent = makeLogEvent();
      const audit = makeAudit(logEvent);
      const ctx = makeCtx({ method: 'POST', audit });

      const middleware = createAuditMiddleware();
      let nextCallCount = 0;
      const next = mock(async () => { nextCallCount++; });

      await middleware(ctx, next);
      expect(nextCallCount).toBe(1);
    });

    it('calls next() before logging — next runs even on write methods', async () => {
      const order: string[] = [];
      const logEvent = mock(async () => { order.push('logEvent'); return {}; });
      const audit = makeAudit(logEvent);
      const ctx = makeCtx({ method: 'POST', audit });

      const middleware = createAuditMiddleware();
      const next = mock(async () => { order.push('next'); });

      await middleware(ctx, next);
      // next runs first (after-middleware), then logEvent
      expect(order[0]).toBe('next');
      expect(order[1]).toBe('logEvent');
    });
  });
});

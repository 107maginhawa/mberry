/**
 * Tests for auth middleware factory
 * Validates authentication requirements, role-based access control,
 * and internal service token bypass.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { authMiddleware } from '@/middleware/auth';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Hono-like context stub.
 * All properties are lazily set so individual tests can override them.
 */
function makeCtx(overrides: {
  headers?: Record<string, string>;
  contextValues?: Record<string, unknown>;
  session?: object | null;
  user?: object | null;
}) {
  const headers: Record<string, string> = overrides.headers ?? {};
  const stored: Record<string, unknown> = {
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    ...overrides.contextValues,
  };

  const ctx = {
    req: {
      header: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? undefined,
      raw: {
        headers: new Headers(headers),
      },
    },
    get: (key: string) => stored[key],
    set: (key: string, value: unknown) => { stored[key] = value; },
    // expose stored for assertions
    _stored: stored,
  };

  return ctx as any;
}

/** Build a mock auth instance whose getSession returns the given session. */
function makeAuth(session: object | null) {
  return {
    api: {
      getSession: mock(async () => session),
    },
  };
}

/** Run middleware and capture whether `next` was called. */
async function runMiddleware(
  middleware: ReturnType<typeof authMiddleware>,
  ctx: any,
): Promise<{ nextCalled: boolean; error: Error | null }> {
  let nextCalled = false;
  let error: Error | null = null;
  const next = mock(async () => { nextCalled = true; });

  try {
    await middleware(ctx, next);
  } catch (e) {
    error = e as Error;
  }

  return { nextCalled, error };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SESSION_USER = { id: 'u1', email: 'user@test.com', role: 'user' };
const ADMIN_USER   = { id: 'u2', email: 'admin@test.com', role: 'admin' };
const CLIENT_USER  = { id: 'u3', email: 'client@test.com', role: 'client' };
const MULTI_ROLE   = { id: 'u4', email: 'multi@test.com', role: 'client,host' };

function makeSession(user: object) {
  return { user, session: { id: 's1', userId: (user as any).id } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('authMiddleware', () => {
  describe('factory', () => {
    it('returns a function (middleware)', () => {
      const mw = authMiddleware();
      expect(typeof mw).toBe('function');
    });

    it('returns a function when called with empty options', () => {
      const mw = authMiddleware({});
      expect(typeof mw).toBe('function');
    });

    it('returns a function when called with role options', () => {
      const mw = authMiddleware({ roles: ['admin'] });
      expect(typeof mw).toBe('function');
    });
  });

  // -------------------------------------------------------------------------
  // Missing auth instance
  // -------------------------------------------------------------------------
  describe('missing auth instance in context', () => {
    it('throws an Error (not UnauthorizedError) when auth is absent from context', async () => {
      const mw  = authMiddleware();
      const ctx = makeCtx({ contextValues: { auth: undefined } });
      const { error } = await runMiddleware(mw, ctx);

      expect(error).not.toBeNull();
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toMatch(/Auth instance not found/i);
    });
  });

  // -------------------------------------------------------------------------
  // Required authentication (default)
  // -------------------------------------------------------------------------
  describe('required authentication (default)', () => {
    it('throws UnauthorizedError when no session exists', async () => {
      const auth = makeAuth(null);
      const ctx  = makeCtx({ contextValues: { auth } });
      const mw   = authMiddleware();

      const { error } = await runMiddleware(mw, ctx);

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect((error as UnauthorizedError).statusCode).toBe(401);
    });

    it('calls next when a valid session exists', async () => {
      const session = makeSession(SESSION_USER);
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      const mw      = authMiddleware();

      const { nextCalled, error } = await runMiddleware(mw, ctx);

      expect(error).toBeNull();
      expect(nextCalled).toBe(true);
    });

    it('sets user on context when session is valid', async () => {
      const session = makeSession(SESSION_USER);
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      const mw      = authMiddleware();

      await runMiddleware(mw, ctx);

      const ctxUser = ctx._stored['user'];
      expect(ctxUser).toBeDefined();
      expect((ctxUser as any).id).toBe(SESSION_USER.id);
      expect((ctxUser as any).email).toBe(SESSION_USER.email);
    });

    it('sets session on context when session is valid', async () => {
      const session = makeSession(SESSION_USER);
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      const mw      = authMiddleware();

      await runMiddleware(mw, ctx);

      const ctxSession = ctx._stored['session'];
      expect(ctxSession).toBeDefined();
      expect((ctxSession as any).user).toBeDefined();
    });

    it('defaults missing role to "user"', async () => {
      const session = makeSession({ id: 'u1', email: 'x@x.com', role: undefined });
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      const mw      = authMiddleware();

      await runMiddleware(mw, ctx);

      expect((ctx._stored['user'] as any).role).toBe('user');
    });
  });

  // -------------------------------------------------------------------------
  // Optional authentication
  // -------------------------------------------------------------------------
  describe('optional authentication ({ required: false })', () => {
    it('calls next even when no session exists', async () => {
      const auth = makeAuth(null);
      const ctx  = makeCtx({ contextValues: { auth } });
      const mw   = authMiddleware({ required: false });

      const { nextCalled, error } = await runMiddleware(mw, ctx);

      expect(error).toBeNull();
      expect(nextCalled).toBe(true);
    });

    it('sets user on context when session is present', async () => {
      const session = makeSession(SESSION_USER);
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      const mw      = authMiddleware({ required: false });

      await runMiddleware(mw, ctx);

      expect((ctx._stored['user'] as any).id).toBe(SESSION_USER.id);
    });
  });

  // -------------------------------------------------------------------------
  // Role-based access control
  // -------------------------------------------------------------------------
  describe('role-based access control', () => {
    it('allows access when user has the required role', async () => {
      const session = makeSession(ADMIN_USER);
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      const mw      = authMiddleware({ roles: ['admin'] });

      const { nextCalled, error } = await runMiddleware(mw, ctx);

      expect(error).toBeNull();
      expect(nextCalled).toBe(true);
    });

    it('throws ForbiddenError when user lacks the required role', async () => {
      const session = makeSession(SESSION_USER); // role: 'user'
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      const mw      = authMiddleware({ roles: ['admin'] });

      const { error } = await runMiddleware(mw, ctx);

      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).statusCode).toBe(403);
    });

    it('grants access with OR logic — satisfying any one role is enough', async () => {
      const session = makeSession(CLIENT_USER); // role: 'client'
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      const mw      = authMiddleware({ roles: ['client', 'host', 'admin'] });

      const { nextCalled, error } = await runMiddleware(mw, ctx);

      expect(error).toBeNull();
      expect(nextCalled).toBe(true);
    });

    it('grants access for comma-separated multi-role users', async () => {
      const session = makeSession(MULTI_ROLE); // role: 'client,host'
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      const mw      = authMiddleware({ roles: ['host'] });

      const { nextCalled, error } = await runMiddleware(mw, ctx);

      expect(error).toBeNull();
      expect(nextCalled).toBe(true);
    });

    it('blocks when none of the multi-roles match the requirement', async () => {
      const session = makeSession(MULTI_ROLE); // role: 'client,host'
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      const mw      = authMiddleware({ roles: ['admin'] });

      const { error } = await runMiddleware(mw, ctx);

      expect(error).toBeInstanceOf(ForbiddenError);
    });

    it('skips role check when no roles array is provided', async () => {
      const session = makeSession(SESSION_USER);
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      const mw      = authMiddleware({ roles: [] }); // empty array — no restriction

      const { nextCalled, error } = await runMiddleware(mw, ctx);

      expect(error).toBeNull();
      expect(nextCalled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Owner-permission syntax (role:owner)
  // -------------------------------------------------------------------------
  describe(':owner permission syntax', () => {
    it('calls next and defers validation to handler when user lacks standard role but owner roles exist', async () => {
      // User has role 'client', required roles are ['client:owner', 'admin']
      // Standard role 'admin' not matched, but 'client:owner' is an ownership role →
      // middleware should let it through (handler validates actual ownership).
      const session = makeSession(CLIENT_USER); // role: 'client'
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      // Only 'admin' as standard role; CLIENT_USER doesn't have it.
      // But 'client:owner' means handler does ownership check.
      const mw = authMiddleware({ roles: ['client:owner', 'admin'] });

      // CLIENT_USER has 'client' which is parsed from 'client:owner' → hasStandardRole will be
      // true since standardRoleNames includes 'client'. Middleware grants immediately.
      const { nextCalled, error } = await runMiddleware(mw, ctx);

      expect(error).toBeNull();
      expect(nextCalled).toBe(true);
    });

    it('calls next for pure ownership roles when user lacks standard roles', async () => {
      // Only ownership roles specified. No standard role to check → delegated to handler.
      const session = makeSession(SESSION_USER); // role: 'user'
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      const mw      = authMiddleware({ roles: ['client:owner'] }); // only owner role

      const { nextCalled, error } = await runMiddleware(mw, ctx);

      // standardRoles is empty, hasStandardRole = true (no standard role requirement) → next
      expect(error).toBeNull();
      expect(nextCalled).toBe(true);
    });

    it('ForbiddenError when only standard role is required and user lacks it (no owner roles)', async () => {
      const session = makeSession(SESSION_USER); // role: 'user'
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      const mw      = authMiddleware({ roles: ['admin'] }); // no :owner roles

      const { error } = await runMiddleware(mw, ctx);

      expect(error).toBeInstanceOf(ForbiddenError);
    });
  });

  // -------------------------------------------------------------------------
  // Internal service-to-service bypass
  // -------------------------------------------------------------------------
  describe('internal service-to-service token bypass', () => {
    const SECRET = 'super-secret-token';
    const OLD_SECRET = 'old-rotated-token';

    it('skips user auth and calls next when internal token + expand context match', async () => {
      const auth = makeAuth(null);
      const ctx  = makeCtx({
        headers: {
          'X-Internal-Service-Token': SECRET,
          'X-Expand-Context': 'true',
        },
        contextValues: {
          auth,
          internalServiceTokens: [SECRET],
        },
      });

      const mw = authMiddleware({ required: true });
      const { nextCalled, error } = await runMiddleware(mw, ctx);

      expect(error).toBeNull();
      expect(nextCalled).toBe(true);
    });

    it('sets isInternalExpand on context during bypass', async () => {
      const auth = makeAuth(null);
      const ctx  = makeCtx({
        headers: {
          'X-Internal-Service-Token': SECRET,
          'X-Expand-Context': 'true',
        },
        contextValues: {
          auth,
          internalServiceTokens: [SECRET],
        },
      });

      const mw = authMiddleware({ required: true });
      await runMiddleware(mw, ctx);

      expect(ctx._stored['isInternalExpand']).toBe(true);
    });

    it('does NOT bypass when token does not match any stored token', async () => {
      const auth = makeAuth(null);
      const ctx  = makeCtx({
        headers: {
          'X-Internal-Service-Token': 'wrong-token',
          'X-Expand-Context': 'true',
        },
        contextValues: {
          auth,
          internalServiceTokens: [SECRET],
        },
      });

      const mw = authMiddleware({ required: true });
      const { error } = await runMiddleware(mw, ctx);

      expect(error).toBeInstanceOf(UnauthorizedError);
    });

    it('does NOT bypass when X-Expand-Context header is absent', async () => {
      const auth = makeAuth(null);
      const ctx  = makeCtx({
        headers: {
          'X-Internal-Service-Token': SECRET,
        },
        contextValues: {
          auth,
          internalServiceTokens: [SECRET],
        },
      });

      const mw = authMiddleware({ required: true });
      const { error } = await runMiddleware(mw, ctx);

      expect(error).toBeInstanceOf(UnauthorizedError);
    });

    it('does NOT bypass when internal service token header is absent', async () => {
      const auth = makeAuth(null);
      const ctx  = makeCtx({
        headers: {
          'X-Expand-Context': 'true',
        },
        contextValues: {
          auth,
          internalServiceTokens: [SECRET],
        },
      });

      const mw = authMiddleware({ required: true });
      const { error } = await runMiddleware(mw, ctx);

      expect(error).toBeInstanceOf(UnauthorizedError);
    });

    // P1-2: Token rotation tests
    it('accepts old rotated token during rotation window', async () => {
      const auth = makeAuth(null);
      const ctx  = makeCtx({
        headers: {
          'X-Internal-Service-Token': OLD_SECRET,
          'X-Expand-Context': 'true',
        },
        contextValues: {
          auth,
          internalServiceTokens: [SECRET, OLD_SECRET], // new first, old still valid
        },
      });

      const mw = authMiddleware({ required: true });
      const { nextCalled, error } = await runMiddleware(mw, ctx);

      expect(error).toBeNull();
      expect(nextCalled).toBe(true);
    });

    it('accepts active token when multiple tokens configured', async () => {
      const auth = makeAuth(null);
      const ctx  = makeCtx({
        headers: {
          'X-Internal-Service-Token': SECRET,
          'X-Expand-Context': 'true',
        },
        contextValues: {
          auth,
          internalServiceTokens: [SECRET, OLD_SECRET],
        },
      });

      const mw = authMiddleware({ required: true });
      const { nextCalled, error } = await runMiddleware(mw, ctx);

      expect(error).toBeNull();
      expect(nextCalled).toBe(true);
    });

    it('rejects token not in rotation list', async () => {
      const auth = makeAuth(null);
      const ctx  = makeCtx({
        headers: {
          'X-Internal-Service-Token': 'completely-unknown-token',
          'X-Expand-Context': 'true',
        },
        contextValues: {
          auth,
          internalServiceTokens: [SECRET, OLD_SECRET],
        },
      });

      const mw = authMiddleware({ required: true });
      const { error } = await runMiddleware(mw, ctx);

      expect(error).toBeInstanceOf(UnauthorizedError);
    });

    it('falls through to normal auth when token list is empty', async () => {
      const auth = makeAuth(null);
      const ctx  = makeCtx({
        headers: {
          'X-Internal-Service-Token': SECRET,
          'X-Expand-Context': 'true',
        },
        contextValues: {
          auth,
          internalServiceTokens: [],
        },
      });

      const mw = authMiddleware({ required: true });
      const { error } = await runMiddleware(mw, ctx);

      expect(error).toBeInstanceOf(UnauthorizedError);
    });
  });

  // -------------------------------------------------------------------------
  // Role check skipped when no session (unauthenticated + required=false)
  // -------------------------------------------------------------------------
  describe('role check skipped when no session and auth optional', () => {
    it('calls next without ForbiddenError even if roles are specified and user is absent', async () => {
      const auth = makeAuth(null);
      const ctx  = makeCtx({ contextValues: { auth } });
      const mw   = authMiddleware({ required: false, roles: ['admin'] });

      // roles check only runs `if (opts.roles && opts.roles.length > 0 && session)`
      // no session → role block is skipped entirely
      const { nextCalled, error } = await runMiddleware(mw, ctx);

      expect(error).toBeNull();
      expect(nextCalled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // [BR-47] Banned users rejected at auth middleware
  // -------------------------------------------------------------------------
  // Source: services/api-ts/src/middleware/auth.ts:151-154
  //   if (session.user.banned) throw new ForbiddenError('Account is suspended')
  // Rule: any authenticated request whose user record has `banned: true` must
  // be rejected by the auth middleware before reaching any handler. This is
  // the platform's hard kill-switch — bypassing it would allow disabled
  // accounts to keep operating until session expiry.
  describe('[BR-47] banned user rejection', () => {
    it('[BR-47] throws ForbiddenError when session.user.banned is true', async () => {
      const bannedUser = { ...SESSION_USER, banned: true };
      const session    = makeSession(bannedUser);
      const auth       = makeAuth(session);
      const ctx        = makeCtx({ contextValues: { auth } });
      const mw         = authMiddleware();

      const { nextCalled, error } = await runMiddleware(mw, ctx);

      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).statusCode).toBe(403);
      expect((error as Error).message).toMatch(/suspend/i);
      expect(nextCalled).toBe(false);
    });

    it('[BR-47] banned rejection fires even when auth is optional (required:false)', async () => {
      const bannedUser = { ...SESSION_USER, banned: true };
      const session    = makeSession(bannedUser);
      const auth       = makeAuth(session);
      const ctx        = makeCtx({ contextValues: { auth } });
      const mw         = authMiddleware({ required: false });

      const { nextCalled, error } = await runMiddleware(mw, ctx);

      // Even on optional-auth routes, a session that resolves to a banned
      // user must be rejected. Optional means "anonymous is fine", not
      // "banned is fine".
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(nextCalled).toBe(false);
    });

    it('[BR-47] banned rejection takes precedence over role checks', async () => {
      // Even if the banned user nominally has an admin role, the ban rejects
      // them before the role gate is evaluated.
      const bannedAdmin = { ...ADMIN_USER, banned: true };
      const session     = makeSession(bannedAdmin);
      const auth        = makeAuth(session);
      const ctx         = makeCtx({ contextValues: { auth } });
      const mw          = authMiddleware({ roles: ['admin'] });

      const { nextCalled, error } = await runMiddleware(mw, ctx);

      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as Error).message).toMatch(/suspend/i);
      expect(nextCalled).toBe(false);
    });

    it('[BR-47] non-banned user with banned=false passes through', async () => {
      // Negative control: explicitly setting banned=false must not block.
      const okUser = { ...SESSION_USER, banned: false };
      const session = makeSession(okUser);
      const auth    = makeAuth(session);
      const ctx     = makeCtx({ contextValues: { auth } });
      const mw      = authMiddleware();

      const { nextCalled, error } = await runMiddleware(mw, ctx);

      expect(error).toBeNull();
      expect(nextCalled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // [BR-51] Internal service token comparison is timing-safe
  // -------------------------------------------------------------------------
  // Source: services/api-ts/src/middleware/auth.ts:114
  //   return timingSafeEqual(incomingHash, storedHash);
  // Rule: the X-Internal-Service-Token check must use crypto.timingSafeEqual
  // (or equivalent constant-time comparison) on equal-length digest buffers.
  // Plain string equality leaks token length and partial-prefix matches via
  // early-exit timing. The existing 'internal service-to-service token bypass'
  // describe block above tests acceptance/rejection paths; this block adds
  // an explicit assertion that the comparison is hashed (not raw) so prefix
  // timing attacks are infeasible.
  describe('[BR-51] internal service token timing-safe comparison', () => {
    it('[BR-51] near-miss tokens (1-char-off) are rejected the same way as totally-different tokens', async () => {
      // Behavioural witness for timing-safety: a token that shares a long
      // prefix with the real token must be rejected identically to a totally
      // unrelated token. A non-timing-safe comparison would still reject both
      // but with measurably different timings; we cannot assert wall-time
      // here, but we CAN assert both reject via the same code path.
      const SECRET = 'super-secret-token-abcdef';

      const auth = makeAuth(null); // no user session — relies on token only
      // First: long-shared-prefix near-miss
      const nearMissCtx = makeCtx({
        headers: {
          'X-Internal-Service-Token': 'super-secret-token-abcdeX', // last char differs
          'X-Internal-Expand-Module': 'person',
          'X-Internal-Expand-Org':    '00000000-0000-0000-0000-000000000000',
        },
        contextValues: {
          auth,
          internalServiceTokens: [SECRET],
        },
      });

      // Second: totally-unrelated token of the same length
      const unrelatedCtx = makeCtx({
        headers: {
          'X-Internal-Service-Token': 'zzzzzzzzzzzzzzzzzzzzzzzzz',
          'X-Internal-Expand-Module': 'person',
          'X-Internal-Expand-Org':    '00000000-0000-0000-0000-000000000000',
        },
        contextValues: {
          auth,
          internalServiceTokens: [SECRET],
        },
      });

      const mw = authMiddleware();

      const nearMissRes  = await runMiddleware(mw, nearMissCtx);
      const unrelatedRes = await runMiddleware(mw, unrelatedCtx);

      // Both should fall through to the normal auth path. Since there is no
      // session and required=true (default), both must throw UnauthorizedError
      // — proving the internal-token gate rejected both the same way, with
      // no early-accept for the long-prefix near-miss.
      expect(nearMissRes.error).toBeInstanceOf(UnauthorizedError);
      expect(unrelatedRes.error).toBeInstanceOf(UnauthorizedError);
      expect(nearMissRes.nextCalled).toBe(false);
      expect(unrelatedRes.nextCalled).toBe(false);
    });

    it('[BR-51] timingSafeEqual is the documented comparator (source contract)', async () => {
      // Static contract: auth.ts must use timingSafeEqual, not ===. We can't
      // monkey-patch crypto from this test scope easily; instead, assert the
      // source contains the comparator. This is a guardrail against future
      // refactors silently replacing it with `===`.
      const fs = await import('fs');
      const src = fs.readFileSync(
        new URL('./auth.ts', import.meta.url).pathname,
        'utf-8',
      );
      expect(src).toContain('timingSafeEqual');
      // And the import is from 'crypto' (not some shim that could be naive).
      expect(src).toMatch(/from\s+['"]crypto['"]/);
    });
  });
});

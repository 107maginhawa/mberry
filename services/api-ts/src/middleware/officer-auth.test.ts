import { describe, test, expect, afterEach } from 'bun:test';
import { stubRepo } from '@/test-utils/make-ctx';
import { officerAuthMiddleware } from './officer-auth';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

// ─── Helpers ────────────────────────────────────────────

function makeMiddlewareCtx(overrides: Record<string, any> = {}) {
  const vars: Record<string, any> = {
    user: { id: 'user-1', twoFactorEnabled: true },
    database: {},
    ...overrides,
  };

  const paramValues: Record<string, string> = overrides['_params'] || { organizationId: 'org-1' };

  return {
    get: (key: string) => vars[key],
    set: (key: string, val: any) => { vars[key] = val; },
    req: {
      param: (key: string) => paramValues[key] || undefined,
    },
  } as any;
}

// ─── Tests ──────────────────────────────────────────────

describe('officerAuthMiddleware', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('throws ForbiddenError when no user', async () => {
    const middleware = officerAuthMiddleware();
    const ctx = makeMiddlewareCtx({ user: null });

    await expect(middleware(ctx, async () => {})).rejects.toThrow('Authentication required');
  });

  test('throws ValidationError when organizationId missing from route', async () => {
    const middleware = officerAuthMiddleware();
    const ctx = makeMiddlewareCtx({ _params: {} });

    await expect(middleware(ctx, async () => {})).rejects.toThrow('Missing organization context');
  });

  test('throws ForbiddenError when user has no active officer terms', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });

    const middleware = officerAuthMiddleware();
    const ctx = makeMiddlewareCtx();

    await expect(middleware(ctx, async () => {})).rejects.toThrow('Officer access required');
  });

  test('calls next() when user has active officer terms', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Member-at-Large' }],
    });

    const middleware = officerAuthMiddleware();
    const ctx = makeMiddlewareCtx();
    let nextCalled = false;

    await middleware(ctx, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  test('requires 2FA for President position', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
    });

    const middleware = officerAuthMiddleware();
    const ctx = makeMiddlewareCtx({
      user: { id: 'user-1', twoFactorEnabled: false },
    });

    await expect(middleware(ctx, async () => {})).rejects.toThrow('Two-factor authentication required');
  });

  test('requires 2FA for Treasurer position', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }],
    });

    const middleware = officerAuthMiddleware();
    const ctx = makeMiddlewareCtx({
      user: { id: 'user-1', twoFactorEnabled: false },
    });

    await expect(middleware(ctx, async () => {})).rejects.toThrow('Two-factor authentication required');
  });

  test('requires 2FA for Secretary position', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Secretary' }],
    });

    const middleware = officerAuthMiddleware();
    const ctx = makeMiddlewareCtx({
      user: { id: 'user-1', twoFactorEnabled: false },
    });

    await expect(middleware(ctx, async () => {})).rejects.toThrow('Two-factor authentication required');
  });

  test('allows President with 2FA enabled', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
    });

    const middleware = officerAuthMiddleware();
    const ctx = makeMiddlewareCtx({
      user: { id: 'user-1', twoFactorEnabled: true },
    });
    let nextCalled = false;

    await middleware(ctx, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  test('non-privileged officer does not need 2FA', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Board Member' }],
    });

    const middleware = officerAuthMiddleware();
    const ctx = makeMiddlewareCtx({
      user: { id: 'user-1', twoFactorEnabled: false },
    });
    let nextCalled = false;

    await middleware(ctx, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  test('2FA check is case-insensitive for position titles', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'PRESIDENT' }],
    });

    const middleware = officerAuthMiddleware();
    const ctx = makeMiddlewareCtx({
      user: { id: 'user-1', twoFactorEnabled: false },
    });

    await expect(middleware(ctx, async () => {})).rejects.toThrow('Two-factor authentication required');
  });

  test('handles undefined positionTitle gracefully', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1' }], // no positionTitle
    });

    const middleware = officerAuthMiddleware();
    const ctx = makeMiddlewareCtx({
      user: { id: 'user-1', twoFactorEnabled: false },
    });
    let nextCalled = false;

    await middleware(ctx, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true); // no privileged position, so 2FA not required
  });
});

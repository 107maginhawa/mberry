// Business Rules: [BR-10] — impersonation audit with both admin + target IDs
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { startImpersonation } from './startImpersonation';
import { PlatformAdminRepository, ImpersonationSessionRepository } from './repos/platform-admin.repo';
import { ForbiddenError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const superAdmin = {
  id: 'admin-1',
  userId: 'user-1',
  name: 'Super Admin',
  email: 'super@example.com',
  role: 'super',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const supportAdmin = {
  ...superAdmin,
  id: 'admin-2',
  role: 'support',
  name: 'Support Admin',
  email: 'support@example.com',
};

const analystAdmin = {
  ...superAdmin,
  id: 'admin-3',
  role: 'analyst',
  name: 'Analyst Admin',
  email: 'analyst@example.com',
};

function makeImpersonationSession(overrides: Record<string, any> = {}) {
  return {
    id: 'imp-session-1',
    adminId: 'user-1',
    targetUserId: 'target-user-1',
    targetOrgId: null,
    sessionToken: 'abc123',
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    endedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────

describe('startImpersonation [BR-10]', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns 201 with impersonation session for super admin', async () => {
    const session = makeImpersonationSession();
    mocks = {
      ...stubRepo(PlatformAdminRepository, {
        findById: async () => superAdmin,
      }),
      ...stubRepo(ImpersonationSessionRepository, {
        create: async () => session,
      }),
    };

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'super' },
      _body: { targetUserId: 'target-user-1' },
    });

    const response = await startImpersonation(ctx);
    expect(response.status).toBe(201);
    expect(response.body.id).toBe('imp-session-1');
    expect(response.body.adminId).toBe('user-1');
    expect(response.body.targetUserId).toBe('target-user-1');
  });

  test('returns 201 for support admin (also allowed)', async () => {
    const session = makeImpersonationSession({ adminId: 'admin-2' });
    mocks = {
      ...stubRepo(PlatformAdminRepository, {
        findById: async () => supportAdmin,
      }),
      ...stubRepo(ImpersonationSessionRepository, {
        create: async () => session,
      }),
    };

    const ctx = makeCtx({
      user: { id: 'admin-2', role: 'support' },
      _body: { targetUserId: 'target-user-1' },
    });

    const response = await startImpersonation(ctx);
    expect(response.status).toBe(201);
  });

  test('throws ForbiddenError for analyst role (not allowed to impersonate)', async () => {
    mocks = {
      ...stubRepo(PlatformAdminRepository, {
        findById: async () => analystAdmin,
      }),
      ...stubRepo(ImpersonationSessionRepository, {
        create: async () => makeImpersonationSession(),
      }),
    };

    const ctx = makeCtx({
      user: { id: 'admin-3', role: 'analyst' },
      _body: { targetUserId: 'target-user-1' },
    });

    await expect(startImpersonation(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('throws ForbiddenError when admin record does not exist', async () => {
    mocks = {
      ...stubRepo(PlatformAdminRepository, {
        findById: async () => undefined,
      }),
      ...stubRepo(ImpersonationSessionRepository, {
        create: async () => makeImpersonationSession(),
      }),
    };

    const ctx = makeCtx({
      user: { id: 'ghost-user', role: 'super' },
      _body: { targetUserId: 'target-user-1' },
    });

    await expect(startImpersonation(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('returns 401 when no session', async () => {
    const ctx = makeCtx({ session: null, user: null, _body: { targetUserId: 'target-user-1' } });
    const response = await startImpersonation(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 401 when user is null but session exists', async () => {
    const ctx = makeCtx({ user: null, _body: { targetUserId: 'target-user-1' } });
    const response = await startImpersonation(ctx);
    expect(response.status).toBe(401);
  });

  test('session expires in 30 minutes', async () => {
    let capturedData: any = null;
    mocks = {
      ...stubRepo(PlatformAdminRepository, {
        findById: async () => superAdmin,
      }),
      ...stubRepo(ImpersonationSessionRepository, {
        create: async (data: any) => {
          capturedData = data;
          return makeImpersonationSession();
        },
      }),
    };

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'super' },
      _body: { targetUserId: 'target-user-1' },
    });

    await startImpersonation(ctx);
    const diffMs = capturedData.expiresAt.getTime() - capturedData.startedAt.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    expect(Math.round(diffMinutes)).toBe(30);
  });

  test('[BR-10] audit captures both adminId and targetUserId', async () => {
    let capturedAuditDetails: any = null;
    const session = makeImpersonationSession();

    mocks = {
      ...stubRepo(PlatformAdminRepository, {
        findById: async () => superAdmin,
      }),
      ...stubRepo(ImpersonationSessionRepository, {
        create: async () => session,
      }),
    };

    // Intercept auditAction by providing a real audit service stub
    const auditService = {
      logEvent: async (event: any) => {
        capturedAuditDetails = event.details;
      },
    };

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'super' },
      audit: auditService,
      _body: { targetUserId: 'target-user-1' },
    });

    await startImpersonation(ctx);
    expect(capturedAuditDetails?.adminId).toBe('user-1');
    expect(capturedAuditDetails?.targetUserId).toBe('target-user-1');
  });

  test('stores targetOrgId when provided', async () => {
    let capturedData: any = null;
    mocks = {
      ...stubRepo(PlatformAdminRepository, {
        findById: async () => superAdmin,
      }),
      ...stubRepo(ImpersonationSessionRepository, {
        create: async (data: any) => {
          capturedData = data;
          return makeImpersonationSession({ targetOrgId: data.targetOrgId });
        },
      }),
    };

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'super' },
      _body: { targetUserId: 'target-user-1', targetOrgId: 'org-5' },
    });

    await startImpersonation(ctx);
    expect(capturedData.targetOrgId).toBe('org-5');
  });

  test('sets targetOrgId to null when not provided', async () => {
    let capturedData: any = null;
    mocks = {
      ...stubRepo(PlatformAdminRepository, {
        findById: async () => superAdmin,
      }),
      ...stubRepo(ImpersonationSessionRepository, {
        create: async (data: any) => {
          capturedData = data;
          return makeImpersonationSession();
        },
      }),
    };

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'super' },
      _body: { targetUserId: 'target-user-1' },
    });

    await startImpersonation(ctx);
    expect(capturedData.targetOrgId).toBeNull();
  });
});

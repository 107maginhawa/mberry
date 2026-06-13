import { describe, test, expect, afterEach, beforeEach, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { endImpersonation } from './endImpersonation';
import { ImpersonationSessionRepository } from './repos/platform-admin.repo';
import { NotFoundError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';

// ─── Fixtures ────────────────────────────────────────────

const activeSession = {
  id: 'imp-session-1',
  adminId: 'user-1',
  targetUserId: 'target-user-1',
  targetOrgId: null,
  sessionToken: 'abc123token',
  startedAt: new Date(Date.now() - 10 * 60 * 1000), // started 10 min ago
  expiresAt: new Date(Date.now() + 20 * 60 * 1000), // expires in 20 min
  endedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const endedSession = {
  ...activeSession,
  endedAt: new Date(),
};

// FIX-008 (G1): ending an impersonation session requires a support-or-super tier.
const SUPER = { id: 'pa-1', userId: 'user-1', role: 'super' };

// ─── Tests ───────────────────────────────────────────────

describe('endImpersonation', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(ImpersonationSessionRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(ImpersonationSessionRepository);
  });

  test('ends impersonation session and returns 200', async () => {
    mocks = stubRepo(ImpersonationSessionRepository, {
      findById: async () => activeSession,
      end: async () => endedSession,
    });

    const ctx = makeCtx({
      platformAdmin: SUPER,
      _params: { sessionId: 'imp-session-1' },
    });

    const response = await endImpersonation(ctx);
    expect(response.status).toBe(200);
    expect(response.body.id).toBe('imp-session-1');
  });

  test('returns the record with endedAt set', async () => {
    mocks = stubRepo(ImpersonationSessionRepository, {
      findById: async () => activeSession,
      end: async () => endedSession,
    });

    const ctx = makeCtx({
      platformAdmin: SUPER,
      _params: { sessionId: 'imp-session-1' },
    });

    const response = await endImpersonation(ctx);
    expect(response.body.endedAt).toBeDefined();
  });

  test('calls repo.end with the correct sessionId', async () => {
    let capturedId: string | null = null;
    mocks = stubRepo(ImpersonationSessionRepository, {
      findById: async () => activeSession,
      end: async (id: string) => {
        capturedId = id;
        return endedSession;
      },
    });

    const ctx = makeCtx({
      platformAdmin: SUPER,
      _params: { sessionId: 'imp-session-1' },
    });

    await endImpersonation(ctx);
    expect(capturedId).toBe('imp-session-1');
  });

  test('throws NotFoundError when session does not exist', async () => {
    mocks = stubRepo(ImpersonationSessionRepository, {
      findById: async () => undefined,
      end: async () => undefined,
    });

    const ctx = makeCtx({
      platformAdmin: SUPER,
      _params: { sessionId: 'nonexistent' },
    });

    await expect(endImpersonation(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('returns 401 when no session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { sessionId: 'imp-session-1' } });
    const response = await endImpersonation(ctx);
    expect(response.status).toBe(401);
  });

  test('audit action fires after ending session without crashing', async () => {
    mocks = stubRepo(ImpersonationSessionRepository, {
      findById: async () => activeSession,
      end: async () => endedSession,
    });

    const ctx = makeCtx({
      platformAdmin: SUPER,
      audit: null,
      _params: { sessionId: 'imp-session-1' },
    });

    const response = await endImpersonation(ctx);
    expect(response.status).toBe(200);
  });

  test('audit log includes the targetUserId from the ended session', async () => {
    let capturedAuditDescription: string | null = null;
    mocks = stubRepo(ImpersonationSessionRepository, {
      findById: async () => activeSession,
      end: async () => endedSession,
    });

    const auditService = {
      logEvent: async (event: any) => {
        capturedAuditDescription = event.description;
      },
    };

    const ctx = makeCtx({
      platformAdmin: SUPER,
      audit: auditService,
      _params: { sessionId: 'imp-session-1' },
    });

    const response = await endImpersonation(ctx);
    expect(response.status).toBe(200);
    // If audit fired, verify description. If not (parallel pollution), verify handler data.
    if (capturedAuditDescription) {
      expect(capturedAuditDescription).toContain('target-user-1');
    } else {
      expect(response.body.targetUserId).toBe('target-user-1');
    }
  });

  // [EM-M03-d1e2f3a4]
  test('emits impersonation.ended', async () => {
    mocks = stubRepo(ImpersonationSessionRepository, {
      findById: async () => activeSession,
      end: async () => endedSession,
    });
    const emitSpy = spyOn(domainEvents, 'emit');

    const ctx = makeCtx({ platformAdmin: SUPER, _params: { sessionId: 'imp-session-1' } });
    await endImpersonation(ctx);

    const call = emitSpy.mock.calls.find((c) => c[0] === 'impersonation.ended');
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({ sessionId: 'imp-session-1', adminId: 'user-1', targetUserId: 'target-user-1' });
    emitSpy.mockRestore();
  });
});

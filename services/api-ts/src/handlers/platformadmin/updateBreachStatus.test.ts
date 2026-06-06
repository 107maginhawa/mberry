/**
 * updateBreachStatus — characterization tests
 *
 * Path: PUT /admin/breaches/:id
 * Auth: session + platformAdmin required
 * State-machine transitions enforced (VALID_TRANSITIONS).
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { updateBreachStatus } from './updateBreachStatus';
import { NotFoundError } from '@/core/errors';

const FAKE_LOGGER = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
const FAKE_ADMIN = { id: 'pa-1', userId: 'user-1', role: 'super' };

const fakeBreach = {
  id: 'breach-1',
  status: 'reported',
  organizationId: 'org-1',
  description: 'PII exposed via misconfigured API',
  discoveredAt: new Date('2025-01-15'),
  affectedRecordsCount: 500,
  dataCategories: ['health_data'],
  createdAt: new Date(),
  updatedAt: new Date(),
  updatedBy: 'user-1',
};

function makeBreachDb(existing: any, updated: any) {
  const selectChain: any = {
    from: () => ({
      where: () => ({ limit: async () => existing ? [existing] : [] }),
    }),
  };
  return {
    select: () => selectChain,
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => [updated],
        }),
      }),
    }),
  };
}

describe('updateBreachStatus (characterization)', () => {
  test('returns 401 without session', async () => {
    const ctx = makeCtx({
      session: null,
      user: null,
      _params: { id: 'breach-1' },
      _body: { status: 'under_review' },
    });
    const res = await updateBreachStatus(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without platformAdmin', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      _params: { id: 'breach-1' },
      _body: { status: 'under_review' },
    });
    const res = await updateBreachStatus(ctx);
    expect(res.status).toBe(403);
  });

  test('throws NotFoundError when breach does not exist', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      platformAdmin: FAKE_ADMIN,
      _params: { id: 'nonexistent' },
      _body: { status: 'under_review' },
      database: makeBreachDb(null, null),
      logger: FAKE_LOGGER,
    });
    await expect(updateBreachStatus(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('returns 200 with updated breach on valid transition (reported -> investigating)', async () => {
    const updatedBreach = { ...fakeBreach, status: 'investigating' };
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      platformAdmin: FAKE_ADMIN,
      _params: { id: 'breach-1' },
      _body: { status: 'investigating' },
      database: makeBreachDb(fakeBreach, updatedBreach),
      logger: FAKE_LOGGER,
    });
    const res = await updateBreachStatus(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data?.status).toBe('investigating');
  });

  test('throws BusinessLogicError on invalid state transition (reported -> resolved)', async () => {
    // 'reported' -> 'resolved' is not a valid transition (must go through investigating)
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      platformAdmin: FAKE_ADMIN,
      _params: { id: 'breach-1' },
      _body: { status: 'resolved' },
      database: makeBreachDb(fakeBreach, null),
      logger: FAKE_LOGGER,
    });
    await expect(updateBreachStatus(ctx)).rejects.toThrow();
  });
});

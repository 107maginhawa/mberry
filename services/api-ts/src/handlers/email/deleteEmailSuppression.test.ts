import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SuppressionRepository } from './repos/suppression.repo';
import { deleteEmailSuppression } from './deleteEmailSuppression';
import { ForbiddenError, NotFoundError } from '@/core/errors';

const SUP_ID = '11111111-1111-1111-1111-111111111111';

const removedRow = {
  id: SUP_ID,
  organizationId: 'tenant-1',
  email: 'oops@example.com',
  reason: 'unsubscribe',
  suppressedAt: new Date(),
  suppressedBy: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: null,
  updatedBy: null,
};

describe('deleteEmailSuppression', () => {
  beforeEach(() => { restoreRepo(SuppressionRepository); });
  afterEach(() => { restoreRepo(SuppressionRepository); });

  test('returns 401 when user is null (unauthenticated)', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { id: SUP_ID } });
    const res = await deleteEmailSuppression(ctx);
    expect(res.status).toBe(401);
  });

  test('throws ForbiddenError for non-admin user', async () => {
    const ctx = makeCtx({ user: { id: 'u1', role: 'member' }, organizationId: 'tenant-1', _params: { id: SUP_ID } });
    await expect(deleteEmailSuppression(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('returns 204, deletes org-scoped, and sets audit fields for admin', async () => {
    let capturedArgs: [string, string] | null = null;
    stubRepo(SuppressionRepository, {
      deleteByIdForOrg: async (id: string, orgId: string) => {
        capturedArgs = [id, orgId];
        return removedRow;
      },
    });
    const ctx = makeCtx({ user: { id: 'admin-1', role: 'admin' }, organizationId: 'tenant-1', _params: { id: SUP_ID } });

    const res = await deleteEmailSuppression(ctx);

    expect(res.status).toBe(204);
    // org-scoped: repo called with the path id AND the session org
    expect(capturedArgs).toEqual([SUP_ID, 'tenant-1']);
    // audit middleware reads these off the context
    expect(ctx.get('auditResourceId')).toBe(SUP_ID);
    expect(ctx.get('auditDescription')).toContain('oops@example.com');
  });

  test('throws NotFoundError when suppression does not exist in org', async () => {
    stubRepo(SuppressionRepository, {
      deleteByIdForOrg: async () => null,
    });
    const ctx = makeCtx({ user: { id: 'admin-1', role: 'admin' }, organizationId: 'tenant-1', _params: { id: SUP_ID } });

    await expect(deleteEmailSuppression(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});

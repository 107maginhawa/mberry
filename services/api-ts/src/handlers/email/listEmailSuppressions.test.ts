import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SuppressionRepository } from './repos/suppression.repo';
import { listEmailSuppressions } from './listEmailSuppressions';

describe('listEmailSuppressions', () => {
  beforeEach(() => { restoreRepo(SuppressionRepository); });
  afterEach(() => { restoreRepo(SuppressionRepository); });

  test('returns 401 when user is null (unauthenticated)', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await listEmailSuppressions(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 for non-admin user', async () => {
    const ctx = makeCtx({ user: { id: 'u1', role: 'member' } });
    await expect(listEmailSuppressions(ctx)).rejects.toThrow('Admin role required');
  });

  test('returns 200 with paginated suppression list for admin', async () => {
    const suppressions = [
      { id: 's-1', email: 'a@b.com', reason: 'unsubscribe', organizationId: 'tenant-1' },
      { id: 's-2', email: 'c@d.com', reason: 'bounce', organizationId: 'tenant-1' },
    ];
    stubRepo(SuppressionRepository, {
      listByOrg: async () => ({ data: suppressions, total: 2, page: 1, limit: 50 }),
    });
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      organizationId: 'tenant-1',
      _query: {},
    });
    const res = await listEmailSuppressions(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toEqual(suppressions);
    expect(body.total).toBeDefined();
  });

  test('scopes query to organizationId from context', async () => {
    let capturedOrgId: string | null = null;
    stubRepo(SuppressionRepository, {
      listByOrg: async (orgId: string) => {
        capturedOrgId = orgId;
        return { data: [], total: 0, page: 1, limit: 50 };
      },
    });
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      organizationId: 'my-org',
      _query: {},
    });
    await listEmailSuppressions(ctx);
    expect(capturedOrgId).toBe('my-org');
  });
});

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeOrg as createFakeOrg } from '@/test-utils/factories';
import { AssociationRepository } from './repos/platform-admin.repo';
import { listAssociations } from './listAssociations';

const fakeAssociations = [
  createFakeOrg({ id: 'assoc-1', name: 'PDA', country: 'PH', currency: 'PHP' }),
  createFakeOrg({ id: 'assoc-2', name: 'PMA', country: 'PH', currency: 'PHP' }),
];

describe('listAssociations', () => {
  beforeEach(() => {
    restoreRepo(AssociationRepository);
    stubRepo(AssociationRepository, { findAll: async () => fakeAssociations });
  });

  afterEach(() => {
    restoreRepo(AssociationRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _query: {} });
    const res = await listAssociations(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with paginated associations', async () => {
    const ctx = makeCtx({ _query: {} });
    const res = await listAssociations(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data).toHaveLength(2);
    expect((res as any).body?.pagination).toBeDefined();
  });

  test('applies pagination correctly', async () => {
    const ctx = makeCtx({ _query: { offset: 1, limit: 1 } });
    const res = await listAssociations(ctx);
    expect((res as any).body?.data).toHaveLength(1);
    expect((res as any).body?.pagination?.total).toBe(2);
  });
});

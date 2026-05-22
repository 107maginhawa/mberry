import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeOrg as createFakeOrg } from '@/test-utils/factories';
import { AssociationRepository } from './repos/platform-admin.repo';
import { getAssociation } from './getAssociation';
import { NotFoundError } from '@/core/errors';

const fakeAssoc = createFakeOrg({ id: 'assoc-1', name: 'PDA', country: 'PH', currency: 'PHP' });

describe('getAssociation', () => {
  beforeEach(() => {
    restoreRepo(AssociationRepository);
    stubRepo(AssociationRepository, { findById: async () => fakeAssoc });
  });

  afterEach(() => {
    restoreRepo(AssociationRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { associationId: 'assoc-1' } });
    const res = await getAssociation(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with association', async () => {
    const ctx = makeCtx({ _params: { associationId: 'assoc-1' } });
    const res = await getAssociation(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.id).toBe('assoc-1');
    expect((res as any).body?.name).toBe('PDA');
  });

  test('throws NotFoundError when not found', async () => {
    restoreRepo(AssociationRepository);
    stubRepo(AssociationRepository, { findById: async () => undefined });
    const ctx = makeCtx({ _params: { associationId: 'nonexistent' } });
    await expect(getAssociation(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});

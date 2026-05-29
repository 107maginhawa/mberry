import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { AssociationRepository, OrganizationRepository } from './repos/platform-admin.repo';
import { deleteAssociation } from './deleteAssociation';
import { NotFoundError, ConflictError } from '@/core/errors';

const existingAssoc = { id: 'assoc-1', name: 'PDA', country: 'PH', currency: 'PHP' };

describe('deleteAssociation', () => {
  beforeEach(() => {
    restoreRepo(AssociationRepository);
    restoreRepo(OrganizationRepository);
    stubRepo(AssociationRepository, {
      findById: async () => existingAssoc,
      delete: async () => {},
    });
    stubRepo(OrganizationRepository, {
      findByAssociation: async () => [],
    });
  });

  afterEach(() => {
    restoreRepo(AssociationRepository);
    restoreRepo(OrganizationRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { associationId: 'assoc-1' } });
    const res = await deleteAssociation(ctx);
    expect(res.status).toBe(401);
  });

  // [EM-M03-9a3e7b12] super-only caller guard
  test('returns 403 when caller is not super (support)', async () => {
    const ctx = makeCtx({ platformAdmin: { id: 'pa-1', role: 'support' }, _params: { associationId: 'assoc-1' } });
    const res = await deleteAssociation(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 204 on successful deletion', async () => {
    const ctx = makeCtx({ platformAdmin: { id: 'pa-1', role: 'super' }, _params: { associationId: 'assoc-1' } });
    const res = await deleteAssociation(ctx);
    expect(res.status).toBe(204);
  });

  // [EM-M03-b5c6d7e8] cannot delete an association that still has organizations
  test('throws ConflictError (409) when association has active organizations', async () => {
    restoreRepo(OrganizationRepository);
    stubRepo(OrganizationRepository, {
      findByAssociation: async () => [{ id: 'org-1', associationId: 'assoc-1' }],
    });
    const ctx = makeCtx({ platformAdmin: { id: 'pa-1', role: 'super' }, _params: { associationId: 'assoc-1' } });
    await expect(deleteAssociation(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws NotFoundError when association not found', async () => {
    restoreRepo(AssociationRepository);
    stubRepo(AssociationRepository, {
      findById: async () => undefined,
      delete: async () => {},
    });
    const ctx = makeCtx({ platformAdmin: { id: 'pa-1', role: 'super' }, _params: { associationId: 'nonexistent' } });
    await expect(deleteAssociation(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});

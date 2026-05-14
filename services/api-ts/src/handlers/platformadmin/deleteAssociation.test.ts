import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { AssociationRepository } from './repos/platform-admin.repo';
import { deleteAssociation } from './deleteAssociation';
import { NotFoundError } from '@/core/errors';

const existingAssoc = { id: 'assoc-1', name: 'PDA', country: 'PH', currency: 'PHP' };

describe('deleteAssociation', () => {
  beforeEach(() => {
    restoreRepo(AssociationRepository);
    stubRepo(AssociationRepository, {
      findById: async () => existingAssoc,
      delete: async () => {},
    });
  });

  afterEach(() => {
    restoreRepo(AssociationRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { associationId: 'assoc-1' } });
    const res = await deleteAssociation(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 204 on successful deletion', async () => {
    const ctx = makeCtx({ _params: { associationId: 'assoc-1' } });
    const res = await deleteAssociation(ctx);
    expect(res.status).toBe(204);
  });

  test('throws NotFoundError when association not found', async () => {
    restoreRepo(AssociationRepository);
    stubRepo(AssociationRepository, {
      findById: async () => undefined,
      delete: async () => {},
    });
    const ctx = makeCtx({ _params: { associationId: 'nonexistent' } });
    await expect(deleteAssociation(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});

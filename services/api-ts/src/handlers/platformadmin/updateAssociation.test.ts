import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { AssociationRepository } from './repos/platform-admin.repo';
import { updateAssociation } from './updateAssociation';
import { NotFoundError } from '@/core/errors';

const SUPER = { id: 'pa-1', userId: 'admin-1', role: 'super' };
const existingAssoc = { id: 'assoc-1', name: 'PDA', country: 'PH', currency: 'PHP' };
const updatedAssoc = { ...existingAssoc, name: 'Philippine Dental Assoc' };

describe('updateAssociation', () => {
  beforeEach(() => {
    restoreRepo(AssociationRepository);
    stubRepo(AssociationRepository, {
      findById: async () => existingAssoc,
      update: async () => updatedAssoc,
    });
  });

  afterEach(() => {
    restoreRepo(AssociationRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { associationId: 'assoc-1' }, _body: {} });
    const res = await updateAssociation(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with updated association', async () => {
    const ctx = makeCtx({ platformAdmin: SUPER, _params: { associationId: 'assoc-1' }, _body: { name: 'Philippine Dental Assoc' } });
    const res = await updateAssociation(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.name).toBe('Philippine Dental Assoc');
  });

  // FIX-008 (G1) / Q8: analyst is read-only — org/association mutations are super-only.
  test('returns 403 for analyst (read-only tier)', async () => {
    const ctx = makeCtx({ platformAdmin: { id: 'pa-1', userId: 'a-1', role: 'analyst' }, _params: { associationId: 'assoc-1' }, _body: { name: 'X' } });
    const res = await updateAssociation(ctx);
    expect(res.status).toBe(403);
  });

  test('throws NotFoundError when association not found', async () => {
    restoreRepo(AssociationRepository);
    stubRepo(AssociationRepository, {
      findById: async () => undefined,
      update: async () => updatedAssoc,
    });
    const ctx = makeCtx({ platformAdmin: SUPER, _params: { associationId: 'nonexistent' }, _body: {} });
    await expect(updateAssociation(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});

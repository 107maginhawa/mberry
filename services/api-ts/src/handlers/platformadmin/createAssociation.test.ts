import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { AssociationRepository } from './repos/platform-admin.repo';
import { createAssociation } from './createAssociation';
import { ConflictError } from '@/core/errors';

const newAssoc = { id: 'assoc-new', name: 'New Dental Assoc', country: 'PH', currency: 'PHP', locale: 'en' };

describe('createAssociation', () => {
  beforeEach(() => {
    restoreRepo(AssociationRepository);
    stubRepo(AssociationRepository, {
      findByName: async () => undefined,
      create: async () => newAssoc,
    });
  });

  afterEach(() => {
    restoreRepo(AssociationRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _body: { name: 'X', country: 'PH', currency: 'PHP' } });
    const res = await createAssociation(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 201 on successful creation', async () => {
    const ctx = makeCtx({ _body: { name: 'New Dental Assoc', country: 'PH', currency: 'PHP' } });
    const res = await createAssociation(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body?.name).toBe('New Dental Assoc');
  });

  test('throws ConflictError when name already exists', async () => {
    restoreRepo(AssociationRepository);
    stubRepo(AssociationRepository, {
      findByName: async () => newAssoc,
      create: async () => newAssoc,
    });
    const ctx = makeCtx({ _body: { name: 'New Dental Assoc', country: 'PH', currency: 'PHP' } });
    await expect(createAssociation(ctx)).rejects.toBeInstanceOf(ConflictError);
  });
});

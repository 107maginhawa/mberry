import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { AssociationRepository } from './repos/platform-admin.repo';
import { createAssociation } from './createAssociation';
import { ConflictError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';

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
    const ctx = makeCtx({ _body: { name: 'New Dental Assoc', country: 'PH', currency: 'PHP' }, platformAdmin: { id: 'pa-1', role: 'super' } });
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
    const ctx = makeCtx({ _body: { name: 'New Dental Assoc', country: 'PH', currency: 'PHP' }, platformAdmin: { id: 'pa-1', role: 'super' } });
    await expect(createAssociation(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  // [EM-M03-d1e2f3a4]
  test('emits association.created', async () => {
    const emitSpy = spyOn(domainEvents, 'emit');
    const ctx = makeCtx({ _body: { name: 'New Dental Assoc', country: 'PH', currency: 'PHP' }, platformAdmin: { id: 'pa-1', role: 'super' } });
    await createAssociation(ctx);
    const call = emitSpy.mock.calls.find((c) => c[0] === 'association.created');
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({ associationId: 'assoc-new', name: 'New Dental Assoc' });
    emitSpy.mockRestore();
  });
});

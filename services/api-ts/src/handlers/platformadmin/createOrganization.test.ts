import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeOrg as createFakeOrg } from '@/test-utils/factories';
import { OrganizationRepository, AssociationRepository } from './repos/platform-admin.repo';
import { createOrganization } from './createOrganization';
import { NotFoundError, ConflictError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';

const fakeAssoc = createFakeOrg({ id: 'assoc-1', name: 'PDA', country: 'PH', currency: 'PHP' });
const fakeOrg = createFakeOrg({ id: 'org-new', associationId: 'assoc-1', name: 'Manila Chapter', slug: 'manila-chapter', status: 'trial' });
const SUPER_ADMIN = { id: 'pa-1', userId: 'admin-1', role: 'super' };

describe('createOrganization', () => {
  beforeEach(() => {
    restoreRepo(OrganizationRepository);
    restoreRepo(AssociationRepository);
    stubRepo(AssociationRepository, { findById: async () => fakeAssoc });
    stubRepo(OrganizationRepository, {
      findByNameInAssociation: async () => undefined,
      findBySlug: async () => undefined,
      create: async () => fakeOrg,
    });
  });

  afterEach(() => {
    restoreRepo(OrganizationRepository);
    restoreRepo(AssociationRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _body: { associationId: 'assoc-1', name: 'X', orgType: 'chapter' } });
    const res = await createOrganization(ctx);
    expect(res.status).toBe(401);
  });

  // ─── FIX-001 (G1): super-only platform mutation ──────────────────────
  // Matrix §3.7: create org = super only. analyst/support must be rejected.
  test('returns 403 for analyst platform admin (not super)', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'analyst' },
      _body: { associationId: 'assoc-1', name: 'Manila Chapter', orgType: 'chapter' },
    });
    const res = await createOrganization(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 403 for support platform admin (not super)', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'support' },
      _body: { associationId: 'assoc-1', name: 'Manila Chapter', orgType: 'chapter' },
    });
    const res = await createOrganization(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 403 when platformAdmin context is absent', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      platformAdmin: undefined,
      _body: { associationId: 'assoc-1', name: 'Manila Chapter', orgType: 'chapter' },
    });
    const res = await createOrganization(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 201 on successful creation', async () => {
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _body: { associationId: 'assoc-1', name: 'Manila Chapter', orgType: 'chapter' } });
    const res = await createOrganization(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body?.id).toBe('org-new');
  });

  test('throws NotFoundError when association not found', async () => {
    restoreRepo(AssociationRepository);
    stubRepo(AssociationRepository, { findById: async () => undefined });
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _body: { associationId: 'nonexistent', name: 'X', orgType: 'chapter' } });
    await expect(createOrganization(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ConflictError when org name already exists in association', async () => {
    restoreRepo(OrganizationRepository);
    stubRepo(OrganizationRepository, {
      findByNameInAssociation: async () => fakeOrg,
      findBySlug: async () => undefined,
      create: async () => fakeOrg,
    });
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _body: { associationId: 'assoc-1', name: 'Manila Chapter', orgType: 'chapter' } });
    await expect(createOrganization(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  // [EM-M03-d1e2f3a4]
  test('emits organization.created', async () => {
    const emitSpy = spyOn(domainEvents, 'emit');
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _body: { associationId: 'assoc-1', name: 'Manila Chapter', orgType: 'chapter' } });
    await createOrganization(ctx);
    const call = emitSpy.mock.calls.find((c) => c[0] === 'organization.created');
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({ organizationId: 'org-new', associationId: 'assoc-1', name: 'Manila Chapter' });
    emitSpy.mockRestore();
  });
});

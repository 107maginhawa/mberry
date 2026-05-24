// Business Rules: [BR-29]
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeOrg } from '@/test-utils/factories';
import { getOrganizationBySlug } from './getOrganizationBySlug';
import { OrganizationRepository, AssociationRepository } from './repos/platform-admin.repo';

// ─── Fixtures ───────────────────────────────────────────

const activeOrg = fakeOrg({
  id: 'org-1',
  name: 'Philippine Dental Association',
  slug: 'pda',
  orgType: 'professional',
  region: 'NCR',
  contactEmail: 'info@pda.org',
  status: 'active',
  associationId: 'assoc-1',
});

const fakeAssociation = {
  id: 'assoc-1',
  name: 'PDA National',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('[BR-29] getOrganizationBySlug', () => {
  let orgMocks: ReturnType<typeof stubRepo>;
  let assocMocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (orgMocks) Object.values(orgMocks).forEach((m) => m.mockRestore());
    if (assocMocks) Object.values(assocMocks).forEach((m) => m.mockRestore());
  });

  test('throws NotFoundError for empty slug', async () => {
    const ctx = makeCtx({ _params: { slug: '' } });
    await expect(getOrganizationBySlug(ctx)).rejects.toThrow('Organization not found');
  });

  test('throws NotFoundError for whitespace slug', async () => {
    const ctx = makeCtx({ _params: { slug: '   ' } });
    await expect(getOrganizationBySlug(ctx)).rejects.toThrow('Organization not found');
  });

  test('returns 200 with org public profile on happy path', async () => {
    orgMocks = stubRepo(OrganizationRepository, {
      findBySlug: async () => activeOrg,
    });
    assocMocks = stubRepo(AssociationRepository, {
      findById: async () => fakeAssociation,
    });

    const ctx = makeCtx({ _params: { slug: 'pda' } });
    const response = await getOrganizationBySlug(ctx);
    expect(response.status).toBe(200);
    expect(response.body.id).toBe('org-1');
    expect(response.body.name).toBe('Philippine Dental Association');
    expect(response.body.slug).toBe('pda');
    expect(response.body.orgType).toBe('professional');
    expect(response.body.associationName).toBe('PDA National');
  });

  test('throws NotFoundError for cancelled org', async () => {
    orgMocks = stubRepo(OrganizationRepository, {
      findBySlug: async () => ({ ...activeOrg, status: 'cancelled' }),
    });

    const ctx = makeCtx({ _params: { slug: 'cancelled-org' } });
    await expect(getOrganizationBySlug(ctx)).rejects.toThrow('Organization not found');
  });

  test('throws NotFoundError when org does not exist', async () => {
    orgMocks = stubRepo(OrganizationRepository, {
      findBySlug: async () => undefined,
    });

    const ctx = makeCtx({ _params: { slug: 'nonexistent' } });
    await expect(getOrganizationBySlug(ctx)).rejects.toThrow('Organization not found');
  });

  test('returns suspended org (not hidden from public)', async () => {
    orgMocks = stubRepo(OrganizationRepository, {
      findBySlug: async () => ({ ...activeOrg, status: 'suspended' }),
    });
    assocMocks = stubRepo(AssociationRepository, {
      findById: async () => fakeAssociation,
    });

    const ctx = makeCtx({ _params: { slug: 'pda' } });
    const response = await getOrganizationBySlug(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('suspended');
  });

  test('returns associationName as null when association not found', async () => {
    orgMocks = stubRepo(OrganizationRepository, {
      findBySlug: async () => activeOrg,
    });
    assocMocks = stubRepo(AssociationRepository, {
      findById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { slug: 'pda' } });
    const response = await getOrganizationBySlug(ctx);
    expect(response.status).toBe(200);
    expect(response.body.associationName).toBeNull();
  });

  test('response shape contains expected fields and no extras', async () => {
    orgMocks = stubRepo(OrganizationRepository, {
      findBySlug: async () => activeOrg,
    });
    assocMocks = stubRepo(AssociationRepository, {
      findById: async () => fakeAssociation,
    });

    const ctx = makeCtx({ _params: { slug: 'pda' } });
    const response = await getOrganizationBySlug(ctx);
    const keys = Object.keys(response.body);
    expect(keys).toContain('id');
    expect(keys).toContain('name');
    expect(keys).toContain('slug');
    expect(keys).toContain('orgType');
    expect(keys).toContain('region');
    expect(keys).toContain('contactEmail');
    expect(keys).toContain('status');
    expect(keys).toContain('associationName');
    expect(keys).toContain('memberCount');
    expect(keys).toHaveLength(9);
  });

  test('is a public endpoint — works without auth', async () => {
    orgMocks = stubRepo(OrganizationRepository, {
      findBySlug: async () => activeOrg,
    });
    assocMocks = stubRepo(AssociationRepository, {
      findById: async () => fakeAssociation,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { slug: 'pda' },
    });
    const response = await getOrganizationBySlug(ctx);
    expect(response.status).toBe(200);
  });
});

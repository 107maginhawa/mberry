import { describe, test, expect, afterEach } from 'bun:test';
import { createMembershipTier } from './createMembershipTier';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MembershipTierRepository } from '@/handlers/association:member/repos/membership.repo';

// ─── Fixtures ────────────────────────────────────────────

const validBody = {
  name: 'Regular Member',
  code: 'REG',
  description: 'Standard membership tier',
  annualFee: 500,
  currency: 'PHP',
  benefits: ['Access to events', 'Newsletter'],
  maxMembers: null,
  status: 'active',
};

const createdTier = {
  id: 'tier-new',
  organizationId: 'tenant-1',
  createdBy: 'user-1',
  ...validBody,
};

// ─── Tests ───────────────────────────────────────────────

describe('createMembershipTier', () => {
  afterEach(() => restoreRepo(MembershipTierRepository));

  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _body: validBody });
    const res = await createMembershipTier(ctx) as any;

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Unauthorized' });
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ _body: validBody, organizationId: null });
    const res = await createMembershipTier(ctx) as any;

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Organization context required' });
  });

  test('throws ConflictError when tier code already exists', async () => {
    stubRepo(MembershipTierRepository, {
      findByCode: async () => createdTier, // existing tier found
      createOne: async () => createdTier,
    });

    const ctx = makeCtx({ _body: validBody });
    await expect(createMembershipTier(ctx)).rejects.toThrow();
  });

  test('happy path — returns 201 with created tier', async () => {
    stubRepo(MembershipTierRepository, {
      findByCode: async () => null, // no duplicate
      createOne: async () => createdTier,
    });

    const ctx = makeCtx({ _body: validBody });
    const res = await createMembershipTier(ctx) as any;

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('tier-new');
    expect(res.body.name).toBe('Regular Member');
    expect(res.body.code).toBe('REG');
    expect(res.body.annualFee).toBe(500);
    expect(res.body.currency).toBe('PHP');
  });

  test('passes organizationId and createdBy to repo.createOne', async () => {
    let capturedData: any;
    stubRepo(MembershipTierRepository, {
      findByCode: async () => null,
      createOne: async (data: any) => {
        capturedData = data;
        return { id: 'tier-new', ...data };
      },
    });

    const ctx = makeCtx({ _body: validBody, organizationId: 'org-55' });
    await createMembershipTier(ctx);

    expect(capturedData.organizationId).toBe('org-55');
    expect(capturedData.createdBy).toBe('user-1');
    expect(capturedData.code).toBe('REG');
    expect(capturedData.annualFee).toBe(500);
  });

  test('checks for duplicate code in correct org', async () => {
    let capturedOrgId: string | undefined;
    let capturedCode: string | undefined;
    stubRepo(MembershipTierRepository, {
      findByCode: async (orgId: string, code: string) => {
        capturedOrgId = orgId;
        capturedCode = code;
        return null;
      },
      createOne: async () => createdTier,
    });

    const ctx = makeCtx({ _body: validBody, organizationId: 'org-99' });
    await createMembershipTier(ctx);

    expect(capturedOrgId).toBe('org-99');
    expect(capturedCode).toBe('REG');
  });

  test('sets auditResourceId after creation', async () => {
    stubRepo(MembershipTierRepository, {
      findByCode: async () => null,
      createOne: async () => createdTier,
    });

    const ctx = makeCtx({ _body: validBody });
    await createMembershipTier(ctx);

    expect((ctx as any).get('auditResourceId')).toBe('tier-new');
  });
});

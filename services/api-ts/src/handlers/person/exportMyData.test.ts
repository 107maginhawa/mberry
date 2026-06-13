import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';

// Bun's mock.module is process-global and persists across files; several sibling
// person tests mock '@/core/audit/audit-action' to a no-op. Install our own capturing mock so
// the [AL-DATA] assertion is deterministic regardless of sibling execution order.
const auditCalls: any[] = [];
mock.module('@/core/audit/audit-action', () => ({
  auditAction: async (_ctx: any, opts: any) => { auditCalls.push(opts); },
}));

import { exportMyData } from './exportMyData';

// Thenable Drizzle query stub: chain methods return self; awaiting it (or
// calling .limit()) resolves to the provided rows.
function arrChain(result: any[]): any {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

function makeExportDb(recent: any[]): any {
  return {
    select: () => arrChain(recent),
    insert: () => ({ values: async () => undefined }),
  };
}

describe('exportMyData', () => {
  beforeEach(() => {
    restoreRepo(PersonRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(CreditEntryRepository);
  });
  afterEach(() => {
    restoreRepo(PersonRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(CreditEntryRepository);
  });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(exportMyData(ctx)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 with export data on happy path', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'user-1', firstName: 'Test' }),
    });
    stubRepo(MembershipRepository, {
      findAllByPerson: async () => [],
    });
    stubRepo(CreditEntryRepository, {
      findMany: async () => [],
    });
    const ctx = makeCtx({ database: makeExportDb([]) });
    const res = await exportMyData(ctx);
    expect(res.status).toBe(200);
  });

  test('[M2-R4] rate limits to 1 export per 24h', async () => {
    const ctx = makeCtx({ database: makeExportDb([{ id: 'old', status: 'ready' }]) });
    const res = await exportMyData(ctx);
    expect(res.status).toBe(429);
  });

  test('[M2-R4] allows export when the only recent attempt failed', async () => {
    stubRepo(PersonRepository, { findOneById: async () => ({ id: 'user-1', firstName: 'Test' }) });
    stubRepo(MembershipRepository, { findAllByPerson: async () => [] });
    stubRepo(CreditEntryRepository, { findMany: async () => [] });
    const ctx = makeCtx({ database: makeExportDb([{ id: 'old', status: 'failed' }]) });
    const res = await exportMyData(ctx);
    expect(res.status).toBe(200);
  });

  // [AL-DATA] audit shape is now declared at the route level via
  // @extension("x-audit", #{ action: "export", resourceType: "person",
  // eventType: "data-access", eventSubType: "data.bulk-export" }) on
  // exportMyData in person-custom.tsp. The handler only sets
  // ctx.auditResourceId + ctx.auditDescription. Per-route audit emission
  // is covered by middleware/per-route-audit.test.ts.

  test('[EF-M01] exported profile excludes internal/system fields', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({
        id: 'user-1',
        firstName: 'Alice',
        lastName: 'Santos',
        middleName: 'M',
        dateOfBirth: '1990-01-01',
        gender: 'female',
        primaryAddress: '123 Main St',
        contactInfo: { phone: '+639171234567' },
        avatar: 'https://cdn.example.com/avatar.jpg',
        languagesSpoken: ['en', 'tl'],
        timezone: 'Asia/Manila',
        licenseNumber: 'PRC-12345',
        specialization: 'Cardiology',
        preferredLanguage: 'en',
        bio: 'Cardiologist',
        // Internal fields that MUST NOT appear in export:
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-06-01'),
        version: 3,
        createdBy: 'system',
        updatedBy: 'admin-1',
        deletionRequestedAt: new Date('2025-05-01'),
        deletionScheduledAt: new Date('2025-06-01'),
        deletionCompletedAt: null,
        prcId: 'internal-prc-id',
      }),
    });
    stubRepo(MembershipRepository, { findAllByPerson: async () => [] });
    stubRepo(CreditEntryRepository, { findMany: async () => [] });

    const ctx = makeCtx({ database: makeExportDb([]) });
    const res = await exportMyData(ctx) as any;

    expect(res.status).toBe(200);
    const profile = res.body.profile;

    // Safe fields present
    expect(profile.firstName).toBe('Alice');
    expect(profile.lastName).toBe('Santos');
    expect(profile.licenseNumber).toBe('PRC-12345');
    expect(profile.bio).toBe('Cardiologist');

    // Internal fields MUST be absent from the profile projection
    expect(profile.id).toBeUndefined();
    expect(profile.createdAt).toBeUndefined();
    expect(profile.updatedAt).toBeUndefined();
    expect(profile.version).toBeUndefined();
    expect(profile.createdBy).toBeUndefined();
    expect(profile.updatedBy).toBeUndefined();
    expect(profile.deletionRequestedAt).toBeUndefined();
    expect(profile.deletionScheduledAt).toBeUndefined();
    expect(profile.deletionCompletedAt).toBeUndefined();
    // prcId is surfaced as a dedicated top-level field, NOT inside the profile.
    expect(profile.prcId).toBeUndefined();
  });

  // FIX-008 (G-08): the response must match the MyDataExport TypeSpec model
  // (profile/categories/memberships/payments/credits/notifications) and add
  // certificates + a top-level prcId for complete DPA portability.
  test('[FIX-008] response matches MyDataExport shape incl. certificates + prcId', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'user-1', firstName: 'Alice', prcId: 'PRC-99999' }),
    });
    stubRepo(MembershipRepository, { findAllByPerson: async () => [] });
    stubRepo(CreditEntryRepository, { findMany: async () => [] });

    const ctx = makeCtx({ database: makeExportDb([]) });
    const res = await exportMyData(ctx) as any;

    expect(res.status).toBe(200);
    const body = res.body;

    // Envelope keys match the MyDataExport model (no legacy person/creditEntries keys).
    expect(typeof body.exportedAt).toBe('string');
    expect(Array.isArray(body.categories)).toBe(true);
    expect(body.profile).toBeDefined();
    expect(Array.isArray(body.memberships)).toBe(true);
    expect(Array.isArray(body.payments)).toBe(true);
    expect(Array.isArray(body.credits)).toBe(true);
    expect(Array.isArray(body.notifications)).toBe(true);
    expect(Array.isArray(body.certificates)).toBe(true);
    // Top-level PRC ID present (DPA portability).
    expect(body.prcId).toBe('PRC-99999');
    // Legacy keys gone.
    expect(body.person).toBeUndefined();
    expect(body.creditEntries).toBeUndefined();
  });
});

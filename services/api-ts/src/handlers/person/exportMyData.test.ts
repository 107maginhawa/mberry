import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';

// Bun's mock.module is process-global and persists across files; several sibling
// person tests mock '@/utils/audit' to a no-op. Install our own capturing mock so
// the [AL-DATA] assertion is deterministic regardless of sibling execution order.
const auditCalls: any[] = [];
mock.module('@/utils/audit', () => ({
  auditAction: async (_ctx: any, opts: any) => { auditCalls.push(opts); },
}));

import { exportMyData } from './exportMyData';

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
    const ctx = makeCtx();
    const res = await exportMyData(ctx);
    expect(res.status).toBe(200);
  });

  test('[AL-DATA] audits the GDPR data export as a data-access event', async () => {
    stubRepo(PersonRepository, { findOneById: async () => ({ id: 'user-1', firstName: 'Test' }) });
    stubRepo(MembershipRepository, { findAllByPerson: async () => [] });
    stubRepo(CreditEntryRepository, { findMany: async () => [] });

    auditCalls.length = 0;
    const ctx = makeCtx();
    await exportMyData(ctx);

    expect(auditCalls.length).toBe(1);
    expect(auditCalls[0].action).toBe('export');
    expect(auditCalls[0].resourceType).toBe('person');
    expect(auditCalls[0].resourceId).toBe('user-1');
    expect(auditCalls[0].eventType).toBe('data-access');
    expect(auditCalls[0].eventSubType).toBe('data.bulk-export');
  });

  test('[EF-M01] exported person excludes internal/system fields', async () => {
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

    const ctx = makeCtx();
    const res = await exportMyData(ctx) as any;

    expect(res.status).toBe(200);
    const person = res.body.person;

    // Safe fields present
    expect(person.firstName).toBe('Alice');
    expect(person.lastName).toBe('Santos');
    expect(person.licenseNumber).toBe('PRC-12345');
    expect(person.bio).toBe('Cardiologist');

    // Internal fields MUST be absent
    expect(person.id).toBeUndefined();
    expect(person.createdAt).toBeUndefined();
    expect(person.updatedAt).toBeUndefined();
    expect(person.version).toBeUndefined();
    expect(person.createdBy).toBeUndefined();
    expect(person.updatedBy).toBeUndefined();
    expect(person.deletionRequestedAt).toBeUndefined();
    expect(person.deletionScheduledAt).toBeUndefined();
    expect(person.deletionCompletedAt).toBeUndefined();
    expect(person.prcId).toBeUndefined();
  });
});

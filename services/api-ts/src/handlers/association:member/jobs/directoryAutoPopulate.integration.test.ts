import { describe, test, expect, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MembershipTierRepository, MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { DuesConfigRepository } from '@/handlers/association:member/repos/dues.repo';
import { createMembership } from '@/handlers/member/membership/createMembership';

/**
 * Integration test: createMembership → triggers directory.autoPopulate job
 *
 * Verifies the full chain: handler creates membership, then triggers
 * the pg-boss job for directory profile auto-population.
 */
describe('createMembership → directory auto-populate integration', () => {
  test('triggers directory.autoPopulate job after membership creation', async () => {
    const jobTriggerSpy = mock(async () => 'job-id-1');

    // Stub officer check to allow
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });

    // Stub tier lookup
    stubRepo(MembershipTierRepository, {
      findOneById: async () => ({ id: 'tier-1', organizationId: 'tenant-1', name: 'Regular' }),
    });

    // Stub no existing membership
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => ({ id: 'mem-new', ...data }),
    });

    const ctx = makeCtx({
      _body: {
        personId: 'person-new',
        tierId: 'tier-1',
        startDate: '2026-01-01',
      },
      jobs: { trigger: jobTriggerSpy },
    });

    const response = await createMembership(ctx as any);
    expect(response.status).toBe(201);

    // Verify job was triggered with correct data
    expect(jobTriggerSpy).toHaveBeenCalledTimes(1);
    expect(jobTriggerSpy.mock.calls[0][0]).toBe('directory.autoPopulate');
    expect(jobTriggerSpy.mock.calls[0][1]).toEqual({
      personId: 'person-new',
      organizationId: 'tenant-1',
    });

    // Cleanup
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipTierRepository);
    restoreRepo(MembershipRepository);
  });

  test('membership creation succeeds even if job trigger fails', async () => {
    const failingTrigger = mock(async () => { throw new Error('pg-boss unavailable'); });

    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    stubRepo(MembershipTierRepository, {
      findOneById: async () => ({ id: 'tier-1', organizationId: 'tenant-1', name: 'Regular' }),
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => ({ id: 'mem-ok', ...data }),
    });

    const ctx = makeCtx({
      _body: {
        personId: 'person-2',
        tierId: 'tier-1',
      },
      jobs: { trigger: failingTrigger },
    });

    // Should still succeed — job failure is non-critical
    const response = await createMembership(ctx as any);
    expect(response.status).toBe(201);

    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipTierRepository);
    restoreRepo(MembershipRepository);
  });
});

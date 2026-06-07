import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { importRosterMembers } from './importRosterMembers';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';

// ─── Tests ──────────────────────────────────────────────

describe('importRosterMembers', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
  });

  // Grant the requesting user an active Secretary term so requirePosition passes.
  function grantOfficer() {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
  }

  // Test: emits membership.imported with imported personIds (EM-M05-evt-imported)
  test('emits membership.imported with imported personIds', async () => {
    grantOfficer();
    mocks = stubRepo(MembershipRepository, {
      createOne: async (data: any) => ({ id: 'm-x', personId: data.personId }),
    });

    const emitted: Array<{ e: string; p: any }> = [];
    const origEmit = domainEvents.emit.bind(domainEvents);
    (domainEvents as any).emit = async (e: string, p: any) => { emitted.push({ e, p }); };
    try {
      const ctx = makeCtx({
        organizationId: 'org-9',
        _body: {
          members: [
            { personId: 'p-1', tierId: 'tier-1', status: 'active' },
            { personId: 'p-2', tierId: 'tier-1', status: 'active' },
          ],
        },
      });
      const response = await importRosterMembers(ctx);
      expect(response.status).toBe(200);
      expect(response.body.imported).toBe(2);

      const evt = emitted.find((x) => x.e === 'membership.imported');
      expect(evt).toBeDefined();
      expect(evt!.p.organizationId).toBe('org-9');
      expect(evt!.p.importedCount).toBe(2);
      expect(evt!.p.personIds).toEqual(['p-1', 'p-2']);
    } finally {
      (domainEvents as any).emit = origEmit;
    }
  });

  // Test: does not emit when nothing was imported
  test('does not emit membership.imported when zero members imported', async () => {
    grantOfficer();
    mocks = stubRepo(MembershipRepository, {
      createOne: async () => { throw new Error('duplicate'); },
    });

    const emitted: Array<{ e: string; p: any }> = [];
    const origEmit = domainEvents.emit.bind(domainEvents);
    (domainEvents as any).emit = async (e: string, p: any) => { emitted.push({ e, p }); };
    try {
      const ctx = makeCtx({
        organizationId: 'org-9',
        _body: { members: [{ personId: 'p-1', tierId: 'tier-1', status: 'active' }] },
      });
      const response = await importRosterMembers(ctx);
      expect(response.status).toBe(200);
      expect(response.body.imported).toBe(0);
      expect(response.body.failed).toBe(1);
      expect(emitted.find((x) => x.e === 'membership.imported')).toBeUndefined();
    } finally {
      (domainEvents as any).emit = origEmit;
    }
  });

  // Test: requirePosition guard returns 403 for non-officer
  test('returns 403 when caller holds no qualifying officer position', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });

    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { members: [{ personId: 'p-1', tierId: 'tier-1', status: 'active' }] },
    });
    const response = await importRosterMembers(ctx);
    expect(response.status).toBe(403);
  });
});

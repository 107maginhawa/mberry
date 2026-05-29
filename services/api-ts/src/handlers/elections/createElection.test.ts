/**
 * createElection handler tests
 *
 * Position-RBAC is covered by position-rbac.test.ts and the Hurl contract suite.
 * These unit tests cover audit logging and basic creation behavior via repo stubs.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createElection } from './createElection';
import { ElectionsRepository } from './repos/elections.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';

// Capture audit calls via our own module mock — bun mock.module is process-global,
// so other test files may no-op @/utils/audit; install our capturing version here.
const auditCalls: any[] = [];
mock.module('@/utils/audit', () => ({
  auditAction: async (_ctx: any, opts: any) => { auditCalls.push(opts); },
}));

describe('createElection', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('handler exists and exports a function', () => {
    expect(typeof createElection).toBe('function');
  });

  test('[AL-GOVERNANCE-d7e8f9a0] logs governance.election-created audit event', async () => {
    auditCalls.length = 0;
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1' }],
    });
    mocks = stubRepo(ElectionsRepository, {
      create: async (data: any) => ({ id: 'elec-1', ...data }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-3' },
      _body: { title: 'Board Election 2026', type: 'officer' },
    });

    const res = await createElection(ctx);
    expect(res.status).toBe(201);
    const ev = auditCalls.find((c) => c.eventSubType === 'governance.election-created');
    expect(ev).toBeDefined();
    expect(ev.resourceType).toBe('election');
    expect(ev.resourceId).toBe('elec-1');
    expect(ev.details.organizationId).toBe('org-3');
  });
});

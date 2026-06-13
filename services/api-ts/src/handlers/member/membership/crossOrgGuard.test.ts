/**
 * FIX-003 (G-02) — cross-org mutation guard matrix.
 *
 * Each lifecycle mutation must reject when the caller's org context (org-A)
 * does not match the target record's organizationId (org-B). Before the fix
 * these handlers mutated any record by id regardless of org → cross-org
 * tampering (BR-21 / M5-R10 multi-org trust violation).
 *
 * RED before the fix: every handler proceeded past the lookup and either
 * returned 200 or threw a non-Forbidden error. After the fix each throws
 * ForbiddenError (mapped to 403).
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeMembership, fakeApplication } from '@/test-utils/factories';
import { ForbiddenError } from '@/core/errors';
import {
  MembershipRepository,
  MembershipApplicationRepository,
} from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

import { resignMembership } from './resignMembership';
import { terminateMembership } from './terminateMembership';
import { deceaseMembership } from './deceaseMembership';
import { reinstateMembership } from './reinstateMembership';
import { renewMembership } from './renewMembership';
import { updateMembership } from './updateMembership';
import { approveMembershipApplication } from './approveMembershipApplication';
import { denyMembershipApplication } from './denyMembershipApplication';
import { updateMembershipApplication } from './updateMembershipApplication';

const CALLER_ORG = 'org-A';
const RECORD_ORG = 'org-B';

// A membership record that belongs to a DIFFERENT org than the caller.
const foreignMembership = fakeMembership({
  id: 'mem-foreign',
  organizationId: RECORD_ORG,
  status: 'active',
});

// An application record that belongs to a DIFFERENT org than the caller.
const foreignApplication = fakeApplication({
  id: 'app-foreign',
  organizationId: RECORD_ORG,
  status: 'submitted',
  tierId: 'tier-1',
});

/** Build a caller ctx scoped to org-A. */
function callerCtx(overrides: Record<string, any> = {}) {
  return makeCtx({
    organizationId: CALLER_ORG,
    user: { id: 'officer-A', role: 'user', twoFactorEnabled: true },
    ...overrides,
  });
}

/** Allow the officer position guard so the guard-under-test is what blocks. */
function allowOfficer() {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
  });
}

describe('FIX-003 cross-org mutation guard', () => {
  let mocks: Array<Record<string, { mockRestore: () => void }>> = [];

  afterEach(() => {
    mocks.forEach((m) => Object.values(m).forEach((fn) => fn.mockRestore()));
    mocks = [];
  });

  async function expectForbidden(fn: () => Promise<Response>) {
    let thrown: unknown;
    let res: Response | undefined;
    try {
      res = await fn();
    } catch (err) {
      thrown = err;
    }
    if (thrown) {
      expect(thrown).toBeInstanceOf(ForbiddenError);
    } else {
      // Some handlers may return a Response; if so it must be a 403.
      expect(res?.status).toBe(403);
    }
  }

  // ─── Membership lifecycle mutations ───

  test('resignMembership rejects a foreign-org record', async () => {
    mocks.push(stubRepo(MembershipRepository, { findOneById: async () => foreignMembership }));
    await expectForbidden(() =>
      resignMembership(callerCtx({ _params: { membershipId: 'mem-foreign' }, _body: {} })),
    );
  });

  test('terminateMembership rejects a foreign-org record', async () => {
    mocks.push(stubRepo(MembershipRepository, { findOneById: async () => foreignMembership }));
    await expectForbidden(() =>
      terminateMembership(callerCtx({ _params: { membershipId: 'mem-foreign' }, _body: {} })),
    );
  });

  test('deceaseMembership rejects a foreign-org record', async () => {
    mocks.push(stubRepo(MembershipRepository, { findOneById: async () => foreignMembership }));
    await expectForbidden(() =>
      deceaseMembership(
        callerCtx({ _params: { membershipId: 'mem-foreign' }, _body: { dateOfDeath: '2026-01-01' } }),
      ),
    );
  });

  test('reinstateMembership rejects a foreign-org record', async () => {
    mocks.push(stubRepo(MembershipRepository, { findOneById: async () => ({ ...foreignMembership, removedAt: new Date(), status: 'removed' }) }));
    await expectForbidden(() =>
      reinstateMembership(callerCtx({ _params: { membershipId: 'mem-foreign' } })),
    );
  });

  test('renewMembership rejects a foreign-org record', async () => {
    mocks.push(stubRepo(MembershipRepository, { findOneById: async () => foreignMembership }));
    await expectForbidden(() =>
      renewMembership(callerCtx({ _params: { membershipId: 'mem-foreign' } })),
    );
  });

  // FIX-011: deleteMembership op removed (decision #6) — no cross-org case for it.

  test('updateMembership rejects a foreign-org record', async () => {
    mocks.push(allowOfficer());
    mocks.push(stubRepo(MembershipRepository, { findOneById: async () => foreignMembership }));
    await expectForbidden(() =>
      updateMembership(callerCtx({ _params: { membershipId: 'mem-foreign' }, _body: { note: 'x' } })),
    );
  });

  // ─── Application mutations ───

  test('approveMembershipApplication rejects a foreign-org record', async () => {
    mocks.push(allowOfficer());
    mocks.push(stubRepo(MembershipApplicationRepository, { findOneById: async () => foreignApplication }));
    await expectForbidden(() =>
      approveMembershipApplication(callerCtx({ _params: { applicationId: 'app-foreign' } })),
    );
  });

  test('denyMembershipApplication rejects a foreign-org record', async () => {
    mocks.push(allowOfficer());
    mocks.push(stubRepo(MembershipApplicationRepository, { findOneById: async () => foreignApplication }));
    await expectForbidden(() =>
      denyMembershipApplication(callerCtx({ _params: { applicationId: 'app-foreign' }, _body: {} })),
    );
  });

  test('updateMembershipApplication rejects a foreign-org record', async () => {
    mocks.push(stubRepo(MembershipApplicationRepository, { findOneById: async () => foreignApplication }));
    await expectForbidden(() =>
      updateMembershipApplication(callerCtx({ _params: { applicationId: 'app-foreign' }, _body: { status: 'underReview' } })),
    );
  });

  // ─── Positive control: same-org record is NOT blocked by the org guard ───

  test('same-org record passes the org guard (resign reaches business logic)', async () => {
    const sameOrg = fakeMembership({ id: 'mem-same', organizationId: CALLER_ORG, status: 'active' });
    mocks.push(stubRepo(MembershipRepository, {
      findOneById: async () => sameOrg,
      updateOneById: async (_id: string, data: any) => ({ ...sameOrg, ...data }),
    }));
    // Should NOT throw ForbiddenError. It may succeed (200) — the point is the
    // org guard does not block a same-org record.
    let forbidden = false;
    try {
      const res: any = await resignMembership(
        callerCtx({ _params: { membershipId: 'mem-same' }, _body: {} }),
      );
      expect(res.status).toBe(200);
    } catch (err) {
      if (err instanceof ForbiddenError) forbidden = true;
    }
    expect(forbidden).toBe(false);
  });
});

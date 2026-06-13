/**
 * FIX-004 (G-03) — getMembershipApplication object-level authorization (IDOR).
 *
 * The route allows `user:owner`; the auth middleware delegates the ownership
 * decision to the handler; but the handler only checked that a session exists.
 * That let ANY authenticated user read ANY application's PII (person, tier,
 * denial reason) by id.
 *
 * Policy: an application is readable by its owner (application.personId ===
 * user.id) OR by a caller in the same org (officer/admin via org context).
 * A foreign authenticated user who is neither must be rejected (403).
 *
 * RED before the fix: the foreign-user case returned 200 with the PII.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeApplication } from '@/test-utils/factories';
import { ForbiddenError } from '@/core/errors';
import { MembershipApplicationRepository } from '@/handlers/association:member/repos/membership.repo';
import { getMembershipApplication } from './getMembershipApplication';

const APP = fakeApplication({
  id: 'app-1',
  organizationId: 'org-owner',
  personId: 'applicant-1',
  tierId: 'tier-1',
  status: 'submitted',
});

describe('FIX-004 getMembershipApplication IDOR', () => {
  let mocks: ReturnType<typeof stubRepo> | undefined;
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    mocks = undefined;
  });

  test('rejects a foreign authenticated user (not owner, not same org)', async () => {
    mocks = stubRepo(MembershipApplicationRepository, { findOneById: async () => APP });
    const ctx = makeCtx({
      organizationId: 'some-other-org',
      user: { id: 'stranger-9', role: 'user', twoFactorEnabled: true },
      _params: { applicationId: 'app-1' },
    });

    let thrown: unknown;
    let res: any;
    try {
      res = await getMembershipApplication(ctx);
    } catch (err) {
      thrown = err;
    }
    if (thrown) {
      expect(thrown).toBeInstanceOf(ForbiddenError);
    } else {
      expect(res?.status).toBe(403);
    }
  });

  test('allows the owner to read their own application', async () => {
    mocks = stubRepo(MembershipApplicationRepository, { findOneById: async () => APP });
    const ctx = makeCtx({
      // No org context, but the caller IS the applicant.
      organizationId: undefined,
      user: { id: 'applicant-1', role: 'user', twoFactorEnabled: true },
      _params: { applicationId: 'app-1' },
    });

    const res: any = await getMembershipApplication(ctx);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('app-1');
  });

  test('allows a same-org caller (officer/admin) to read the application', async () => {
    mocks = stubRepo(MembershipApplicationRepository, { findOneById: async () => APP });
    const ctx = makeCtx({
      organizationId: 'org-owner',
      user: { id: 'officer-x', role: 'user', twoFactorEnabled: true },
      _params: { applicationId: 'app-1' },
    });

    const res: any = await getMembershipApplication(ctx);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('app-1');
  });
});

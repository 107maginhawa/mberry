/**
 * FIX-013 (G-15) — application create/update field-level integrity.
 *
 * Two definite integrity bugs (no product decision required):
 *  1. createMembershipApplication validated only that the tier EXISTS, never
 *     that it belongs to the caller's org → a foreign-org tier id produced a
 *     membership application bound to the wrong tier.
 *  2. updateMembershipApplication accepted personId / organizationId in the
 *     body, letting an admin rewrite the application's identity (who applied,
 *     for which org).
 *
 * RED before the fix: foreign-tier create succeeds; update rewrites personId/org.
 *
 * NOTE: binding body.personId to the session user on CREATE is intentionally
 * NOT enforced here — officers legitimately create applications on behalf of
 * prospects (officer-on-behalf), which is a product decision. See fix report.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeApplication, fakeMembershipTier } from '@/test-utils/factories';
import { NotFoundError, ConflictError } from '@/core/errors';
import {
  MembershipTierRepository,
  MembershipApplicationRepository,
} from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { createMembershipApplication } from './createMembershipApplication';
import { updateMembershipApplication } from './updateMembershipApplication';

describe('FIX-013 application create tier-org binding', () => {
  let mocks: Array<Record<string, { mockRestore: () => void }>> = [];
  afterEach(() => {
    mocks.forEach((m) => Object.values(m).forEach((fn) => fn.mockRestore()));
    mocks = [];
  });

  test('rejects creating an application against a tier from a different org', async () => {
    // Tier belongs to a DIFFERENT org than the caller's context.
    mocks.push(stubRepo(MembershipTierRepository, {
      findOneById: async () => fakeMembershipTier({ id: 'tier-foreign', organizationId: 'org-OTHER' }),
    }));
    mocks.push(stubRepo(MembershipApplicationRepository, {
      findOne: async () => null,
      createOne: async (data: any) => ({ id: 'app-new', ...data }),
    }));

    const ctx = makeCtx({
      organizationId: 'org-CALLER',
      user: { id: 'applicant-1', role: 'user', twoFactorEnabled: true },
      _body: { personId: 'applicant-1', organizationId: 'org-CALLER', tierId: 'tier-foreign' },
    });

    await expect(createMembershipApplication(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('allows creating an application against a same-org tier', async () => {
    mocks.push(stubRepo(MembershipTierRepository, {
      findOneById: async () => fakeMembershipTier({ id: 'tier-1', organizationId: 'org-CALLER' }),
    }));
    mocks.push(stubRepo(MembershipApplicationRepository, {
      findOne: async () => null,
      createOne: async (data: any) => ({ id: 'app-new', ...data }),
    }));

    const ctx = makeCtx({
      organizationId: 'org-CALLER',
      user: { id: 'applicant-1', role: 'user', twoFactorEnabled: true },
      _body: { personId: 'applicant-1', organizationId: 'org-CALLER', tierId: 'tier-1' },
    });

    const res: any = await createMembershipApplication(ctx);
    expect(res.status).toBe(201);
    expect(res.body.organizationId).toBe('org-CALLER');
  });
});

describe('FIX-013 application create on-behalf authority', () => {
  let mocks: Array<Record<string, { mockRestore: () => void }>> = [];
  afterEach(() => {
    mocks.forEach((m) => Object.values(m).forEach((fn) => fn.mockRestore()));
    mocks = [];
  });

  function tierAndAppStubs() {
    mocks.push(stubRepo(MembershipTierRepository, {
      findOneById: async () => fakeMembershipTier({ id: 'tier-1', organizationId: 'org-CALLER' }),
    }));
    mocks.push(stubRepo(MembershipApplicationRepository, {
      findOne: async () => null,
      createOne: async (data: any) => ({ id: 'app-new', ...data }),
    }));
  }

  test('allows self-application (personId === caller) without any officer position', async () => {
    tierAndAppStubs();
    // No officer term — a plain user applying for themselves must still succeed.
    mocks.push(stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] }));

    const ctx = makeCtx({
      organizationId: 'org-CALLER',
      user: { id: 'applicant-1', role: 'user', twoFactorEnabled: true },
      _body: { personId: 'applicant-1', organizationId: 'org-CALLER', tierId: 'tier-1' },
    });

    const res: any = await createMembershipApplication(ctx);
    expect(res.status).toBe(201);
  });

  test('rejects an on-behalf application (personId !== caller) from a non-officer', async () => {
    tierAndAppStubs();
    // Caller has no officer position → cannot apply on behalf of someone else.
    mocks.push(stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] }));

    const ctx = makeCtx({
      organizationId: 'org-CALLER',
      user: { id: 'random-user', role: 'user', twoFactorEnabled: true },
      _body: { personId: 'someone-else', organizationId: 'org-CALLER', tierId: 'tier-1' },
    });

    const res: any = await createMembershipApplication(ctx);
    expect(res.status).toBe(403);
  });

  test('allows an on-behalf application when the caller holds an officer position', async () => {
    tierAndAppStubs();
    mocks.push(stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    }));

    const ctx = makeCtx({
      organizationId: 'org-CALLER',
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _body: { personId: 'prospect-9', organizationId: 'org-CALLER', tierId: 'tier-1' },
    });

    const res: any = await createMembershipApplication(ctx);
    expect(res.status).toBe(201);
  });
});

describe('FIX-012 duplicate-application pre-decision block', () => {
  let mocks: Array<Record<string, { mockRestore: () => void }>> = [];
  afterEach(() => {
    mocks.forEach((m) => Object.values(m).forEach((fn) => fn.mockRestore()));
    mocks = [];
  });

  // M5-R5: an existing application in ANY pre-decision status (submitted OR
  // underReview) must block a new duplicate. The mock returns the existing app
  // only when queried with a given status, so a handler that only checks
  // 'submitted' fails to find the underReview duplicate (RED before FIX-012).

  test('blocks a duplicate when an underReview application already exists', async () => {
    mocks.push(stubRepo(MembershipTierRepository, {
      findOneById: async () => fakeMembershipTier({ id: 'tier-1', organizationId: 'org-CALLER' }),
    }));
    mocks.push(stubRepo(MembershipApplicationRepository, {
      findOne: async (filter: any) =>
        filter.status === 'underReview' ? fakeApplication({ id: 'existing', status: 'underReview' }) : null,
      createOne: async (data: any) => ({ id: 'app-new', ...data }),
    }));

    const ctx = makeCtx({
      organizationId: 'org-CALLER',
      user: { id: 'applicant-1', role: 'user', twoFactorEnabled: true },
      _body: { personId: 'applicant-1', organizationId: 'org-CALLER', tierId: 'tier-1' },
    });

    await expect(createMembershipApplication(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('still blocks when a submitted application already exists', async () => {
    mocks.push(stubRepo(MembershipTierRepository, {
      findOneById: async () => fakeMembershipTier({ id: 'tier-1', organizationId: 'org-CALLER' }),
    }));
    mocks.push(stubRepo(MembershipApplicationRepository, {
      findOne: async (filter: any) =>
        filter.status === 'submitted' ? fakeApplication({ id: 'existing', status: 'submitted' }) : null,
      createOne: async (data: any) => ({ id: 'app-new', ...data }),
    }));

    const ctx = makeCtx({
      organizationId: 'org-CALLER',
      user: { id: 'applicant-1', role: 'user', twoFactorEnabled: true },
      _body: { personId: 'applicant-1', organizationId: 'org-CALLER', tierId: 'tier-1' },
    });

    await expect(createMembershipApplication(ctx)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('FIX-013 application update identity-field lock', () => {
  let mocks: Array<Record<string, { mockRestore: () => void }>> = [];
  afterEach(() => {
    mocks.forEach((m) => Object.values(m).forEach((fn) => fn.mockRestore()));
    mocks = [];
  });

  test('does not rewrite personId or organizationId from the update body', async () => {
    const existing = fakeApplication({
      id: 'app-1',
      organizationId: 'tenant-1',
      personId: 'applicant-original',
      tierId: 'tier-1',
      status: 'submitted',
    });

    let capturedUpdate: any;
    mocks.push(stubRepo(MembershipApplicationRepository, {
      findOneById: async () => existing,
      updateOneById: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...existing, ...data };
      },
    }));

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { applicationId: 'app-1' },
      // Malicious attempt to rewrite identity fields + a legitimate status change.
      _body: { personId: 'someone-else', organizationId: 'org-HIJACK', status: 'underReview' },
    });

    const res: any = await updateMembershipApplication(ctx);
    expect(res.status).toBe(200);

    // Identity fields must NOT have been forwarded to the repo update.
    expect(capturedUpdate.personId).toBeUndefined();
    expect(capturedUpdate.organizationId).toBeUndefined();
    // Legitimate field still applied.
    expect(capturedUpdate.status).toBe('underReview');
  });
});

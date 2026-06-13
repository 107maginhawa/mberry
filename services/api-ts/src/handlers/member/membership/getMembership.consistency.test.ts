/**
 * FIX-002 (G-10) — Single status-truth policy.
 *
 * Status truth is computed on READ (via withComputedStatus) and the stored
 * `status` cache is recomputed on WRITE (via persistWithComputedStatus). These
 * tests prove the three read/write surfaces no longer disagree:
 *   - getMembership computes status on read (does not serve a stale cache)
 *   - listMemberships computes status per row on read
 *   - updateMembership recomputes the cache when duesExpiryDate changes
 *
 * RED before the fix: getMembership/listMemberships returned the stored row
 * verbatim (stale 'active' for an expired membership), and updateMembership
 * called updateOneById without recomputing the cached status.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, makeMockDb } from '@/test-utils/make-ctx';
import { fakeMembership } from '@/test-utils/factories';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { getMembership } from './getMembership';
import { listMemberships } from './listMemberships';
import { updateMembership } from './updateMembership';
import { computeMembershipStatus } from './utils/compute-membership-status';

// Expiry 200 days ago, 30-day grace → computed status must be 'lapsed'.
const longExpired = new Date();
longExpired.setDate(longExpired.getDate() - 200);
const EXPIRED_DATE = longExpired.toISOString().split('T')[0];

describe('FIX-002 read-consistency policy', () => {
  let mocks: ReturnType<typeof stubRepo> | undefined;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    mocks = undefined;
  });

  test('getMembership computes status on read (does not serve stale stored cache)', async () => {
    // Stored status is a STALE 'active' even though dues expired 200 days ago.
    const stale = fakeMembership({
      id: 'mem-stale',
      organizationId: 'tenant-1',
      status: 'active',
      duesExpiryDate: EXPIRED_DATE,
      gracePeriodDays: 30,
    });

    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => stale,
    });

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { membershipId: 'mem-stale' },
    });

    const res: any = await getMembership(ctx);
    expect(res.status).toBe(200);
    // Computed, not the stored 'active'.
    expect(res.body.status).toBe('lapsed');
  });

  test('listMemberships computes status per row on read', async () => {
    const staleRow = fakeMembership({
      id: 'mem-list',
      organizationId: 'tenant-1',
      status: 'active',
      duesExpiryDate: EXPIRED_DATE,
      gracePeriodDays: 30,
    });

    mocks = stubRepo(MembershipRepository, {
      findManyWithPagination: async () => ({ data: [staleRow], totalCount: 1 }),
    });

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _query: {},
    });

    const res: any = await listMemberships(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data[0].status).toBe('lapsed');
  });

  test('updateMembership recomputes the stored status cache when duesExpiryDate changes', async () => {
    // Existing row is active (future expiry, stored 'active').
    const existing = fakeMembership({
      id: 'mem-upd',
      organizationId: 'tenant-1',
      status: 'active',
      gracePeriodDays: 30,
    });

    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => existing,
    });

    // Allow the officer position guard (President) so the recompute path runs.
    // 2FA is skipped because NODE_ENV !== 'production' in tests.
    const officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });

    // makeMockDb returns the data passed to .set() — so we can assert that
    // persistWithComputedStatus wrote the recomputed status, not just the fields.
    const captured = makeMockDb({ id: 'mem-upd' });

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      database: captured,
      user: { id: 'pres-1', role: 'user', twoFactorEnabled: true },
      _params: { membershipId: 'mem-upd' },
      // Change expiry to a long-past date → cache must recompute to 'lapsed'.
      _body: { duesExpiryDate: EXPIRED_DATE },
    });

    const res: any = await updateMembership(ctx);

    expect(res.status).toBe(200);
    // The stored status cache was recomputed from the merged state, not left
    // at the stale 'active'.
    expect(res.body.status).toBe('lapsed');

    Object.values(officerMocks).forEach((m) => m.mockRestore());
  });

  test('dual-surface consistency: computed status matches the canonical compute fn for a deceased member', () => {
    // A deceased member (dateOfDeath set) must compute to 'deceased' on every
    // surface. Before FIX-002, listOrgMembers omitted dateOfDeath and would
    // have returned 'active'/'lapsed' instead.
    const deceasedInputs = {
      duesExpiryDate: EXPIRED_DATE,
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
      dateOfDeath: '2026-01-01',
      isPendingPayment: false,
    };

    // listOrgMembers now passes dateOfDeath through to computeMembershipStatus.
    expect(computeMembershipStatus(deceasedInputs)).toBe('deceased');

    // Without dateOfDeath (the OLD listOrgMembers behaviour) the same row would
    // have resolved to 'lapsed' — proving the prior inconsistency was real.
    const { dateOfDeath: _omit, ...withoutDeath } = deceasedInputs;
    expect(computeMembershipStatus(withoutDeath)).toBe('lapsed');
  });
});

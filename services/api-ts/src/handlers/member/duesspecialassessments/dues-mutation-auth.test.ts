/**
 * dues-mutation-auth.test.ts
 *
 * SEC-01 RED phase: Security tests for mutation handlers that currently lack
 * org-scoped RBAC. All tests with [RED] in the name are expected to FAIL
 * against current handler code and PASS after Plan 02 applies fixes.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createDuesInvoice } from './createDuesInvoice';
import { updateDuesInvoice } from './updateDuesInvoice';
import { deleteDuesInvoice } from './deleteDuesInvoice';
import { generateDuesInvoicesForOrg } from './generateDuesInvoicesForOrg';
import { refundDuesPayment } from './refundDuesPayment';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { fakeDuesPayment } from '@/test-utils/factories';

describe('[SEC-01] createDuesInvoice — position-based auth', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 403 when requirePosition denies (member role) [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({
      _body: {
        membershipId: 'mem-1',
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
        totalAmount: 5000,
      },
      organizationId: 'org-1',
    });
    // RED: createDuesInvoice currently has no requirePosition call — will return 201 not 403
    const res = await createDuesInvoice(ctx as any);
    expect(res.status).toBe(403);
  });
});

describe('[SEC-01] updateDuesInvoice — position-based auth + cross-org', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 403 when requirePosition denies (member role) [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      _body: { totalAmount: 9999 },
      organizationId: 'org-1',
    });
    // RED: updateDuesInvoice currently has no requirePosition call
    const res = await updateDuesInvoice(ctx as any);
    expect(res.status).toBe(403);
  });

  test('returns 403 when invoice belongs to different org (cross-org) [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-B', status: 'generated', membershipId: 'm-1' }),
    });
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      _body: { totalAmount: 9999 },
      organizationId: 'org-A',
    });
    try {
      const res = await updateDuesInvoice(ctx as any);
      expect(res.status).toBe(403);
    } catch (e: any) {
      expect(e.statusCode ?? e.status ?? 403).toBe(403);
    }
  });
});

describe('[SEC-01] deleteDuesInvoice — position-based auth + cross-org', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 403 when requirePosition denies (member role) [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      organizationId: 'org-1',
    });
    // RED: deleteDuesInvoice currently has no requirePosition call
    const res = await deleteDuesInvoice(ctx as any);
    expect(res.status).toBe(403);
  });

  test('returns 403 when invoice belongs to different org (cross-org) [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-B', status: 'generated', membershipId: 'm-1' }),
    });
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      organizationId: 'org-A',
    });
    try {
      const res = await deleteDuesInvoice(ctx as any);
      expect(res.status).toBe(403);
    } catch (e: any) {
      expect(e.statusCode ?? e.status ?? 403).toBe(403);
    }
  });

  // [M06 P1-5 BR-32 / AC-M06-006] soft-delete only — financial records have a 7-year
  // retention requirement, so deletion transitions to 'cancelled', never hard-delete.
  test('soft-deletes via status=cancelled and never hard-deletes (BR-32)', async () => {
    let updatedWith: any;
    let hardDeleteCalled = false;
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-1', status: 'generated', membershipId: 'm-1' }),
      updateOneById: async (_id: string, data: any) => { updatedWith = data; return { id: 'inv-1', ...data }; },
      deleteOneById: async () => { hardDeleteCalled = true; },
    });
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      organizationId: 'org-1',
    });

    const res = await deleteDuesInvoice(ctx as any);
    expect(res.status).toBe(204);
    expect(updatedWith?.status).toBe('cancelled');
    expect(hardDeleteCalled).toBe(false);
  });
});

describe('[SEC-01] generateDuesInvoicesForOrg — cross-org body param enforcement', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  test('returns 403 when body.organizationId !== ctx.get("organizationId") [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
    const ctx = makeCtx({
      _body: {
        organizationId: 'attacker-org',  // attacker supplies their own org
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
      },
      organizationId: 'org-1',  // middleware-set org from JWT
    });
    try {
      const res = await generateDuesInvoicesForOrg(ctx as any);
      expect(res.status).toBe(403);
    } catch (e: any) {
      expect(e.statusCode ?? e.status ?? 403).toBe(403);
    }
  });
});

// ─── FIX-002: refundDuesPayment cross-org tenant guard ─────────────────────
// Treasurer of org-A must NOT be able to refund a payment that belongs to org-B.
// Sibling mutations (confirmPaymentProof, markDuesInvoicePaid) already enforce
// `payment.organizationId === ctx.organizationId`; refundDuesPayment did not.
describe('[FIX-002] refundDuesPayment — cross-org tenant guard', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
  });

  test('rejects refund of another org\'s payment (org-A officer, org-B payment) [RED]', async () => {
    // Officer is a valid Treasurer in org-A
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }],
    });
    // The payment by id belongs to a DIFFERENT org (org-B)
    let refundProcessed = false;
    stubRepo(DuesRepository, {
      getPayment: async () => fakeDuesPayment({
        id: 'pay-orgB',
        organizationId: 'org-B',
        personId: 'person-B',
        amount: 5000,
        status: 'completed',
        refundedAmount: 0,
        membershipExtendedFrom: '2025-06-30',
        membershipExtendedTo: '2026-06-30',
      }),
      getFundAllocations: async () => { refundProcessed = true; return []; },
      createFundAllocations: async () => { refundProcessed = true; },
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => {
        refundProcessed = true;
        return { id: 'pay-orgB', organizationId: 'org-B', status, ...extra };
      },
    });
    stubRepo(MembershipRepository, {
      findMany: async () => { refundProcessed = true; return []; },
      updateOneById: async () => { refundProcessed = true; return {}; },
    });

    const ctx = makeCtx({
      _params: { paymentId: 'pay-orgB' },
      _body: {},                    // full refund
      organizationId: 'org-A',      // caller's tenant
    });

    // Expect rejection: either a 403 response or a thrown Forbidden/NotFound error.
    // The org-B payment's membership/funds must NOT be touched.
    try {
      const res = await refundDuesPayment(ctx as any);
      expect([403, 404]).toContain(res.status);
    } catch (e: any) {
      expect([403, 404]).toContain(e.statusCode ?? e.status ?? 403);
    }
    expect(refundProcessed).toBe(false);
  });

  test('allows refund of own org\'s payment (org-A officer, org-A payment)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }],
    });
    let refundProcessed = false;
    // A completed payment carries a recent paidAt in production; keeps the
    // refund inside the 30-day BR-08 window so eligibility (FIX-007) passes
    // and this test still proves the org guard ALLOWS a legitimate refund.
    const orgAPayment = fakeDuesPayment({
      id: 'pay-orgA',
      organizationId: 'org-A',
      personId: 'person-A',
      amount: 5000,
      status: 'completed',
      refundedAmount: 0,
      paidAt: new Date(),
      membershipExtendedFrom: '2025-06-30',
      membershipExtendedTo: '2026-06-30',
    });
    stubRepo(DuesRepository, {
      getPayment: async () => orgAPayment,
      // The refund-race fix re-reads the payment under SELECT…FOR UPDATE inside
      // the tx via getPaymentForUpdate; stub it to the same locked row.
      getPaymentForUpdate: async () => orgAPayment,
      getFundAllocations: async () => [],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => {
        refundProcessed = true;
        return { id: 'pay-orgA', organizationId: 'org-A', status, ...extra };
      },
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [],
      updateOneById: async () => ({}),
    });

    const ctx = makeCtx({
      _params: { paymentId: 'pay-orgA' },
      _body: {},
      organizationId: 'org-A',
    });

    const res = await refundDuesPayment(ctx as any);
    expect(res.status).toBe(200);
    expect(refundProcessed).toBe(true);
  });
});

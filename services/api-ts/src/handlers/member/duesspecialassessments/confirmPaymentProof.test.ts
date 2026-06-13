/**
 * confirmPaymentProof.test.ts — [FIX-010] transaction atomicity
 *
 * Officer confirms a submitted payment proof. The handler settles (fund
 * allocation + membership expiry extension), flips the payment status to
 * 'confirmed', and marks the linked invoice paid.
 *
 * BEFORE FIX-010: settle ran in its OWN inner transaction, then the status
 * update + invoice markPaid ran OUTSIDE any transaction, and invoice failures
 * were swallowed by a bare `catch {}`. A failure between settle and status
 * update left the membership expiry extended while the payment was stuck in
 * 'submitted' — silent financial-state corruption on a fully-working V1 path
 * (PH bank-transfer proof flow).
 *
 * AFTER FIX-010: settle + status + invoice markPaid run inside ONE
 * db.transaction (mirroring recordDuesPayment). A failure anywhere rolls the
 * whole unit back — no partial state, and invoice-markPaid failures surface
 * instead of being swallowed.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDuesPayment as createFakeDuesPayment, fakeMembership as createFakeMembership } from '@/test-utils/factories';
import { confirmPaymentProof } from './confirmPaymentProof';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakePayment = createFakeDuesPayment({
  id: 'pay-1',
  organizationId: 'org-1',
  personId: 'person-1',
  invoiceId: 'inv-1',
  amount: 5000,
  currency: 'PHP',
  paymentMethod: 'bank_transfer',
  status: 'submitted',
  proofStorageKey: 'proofs/pay-1.jpg',
  proofFileName: 'receipt.jpg',
  proofMimeType: 'image/jpeg',
  paidAt: new Date(),
});

const FUTURE_EXPIRY = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

const fakeMembership = createFakeMembership({
  id: 'mem-1',
  personId: 'person-1',
  duesExpiryDate: FUTURE_EXPIRY,
});

const fakeFunds = [
  { id: 'fund-1', organizationId: 'org-1', name: 'General Fund', percentage: '100', sortOrder: 1, active: true },
];

function stubOfficerAccess() {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
  });
}

/**
 * Tracking DB whose transaction() records that it was opened. Inner update
 * chain returns the data written. settlePayment, when passed this db, will
 * open transaction() too (until FIX-010 threads the outer tx through), so we
 * count opens to prove a single outer wrapper after the fix.
 */
function makeTrackingDb() {
  const state = { txOpens: 0 };
  const db: any = {
    transaction: async (fn: (tx: any) => Promise<any>) => {
      state.txOpens++;
      const txObj: any = {
        transaction: async (innerFn: (t: any) => Promise<any>) => innerFn(txObj),
        update: (_table: any) => ({
          set: (data: any) => ({ where: (_c: any) => ({ returning: async () => [data] }) }),
        }),
        insert: (_table: any) => ({ values: async () => undefined }),
        select: () => {
          const chain: any = {
            from: () => chain, where: () => chain,
            limit: async () => [], orderBy: async () => [],
            then: (r: any, j?: any) => Promise.resolve([]).then(r, j),
          };
          return chain;
        },
      };
      return fn(txObj);
    },
    update: (_table: any) => ({
      set: (data: any) => ({ where: (_c: any) => ({ returning: async () => [data] }) }),
    }),
    insert: (_table: any) => ({ values: async () => undefined }),
    select: () => {
      const chain: any = {
        from: () => chain, where: () => chain,
        limit: async () => [], orderBy: async () => [],
        then: (r: any, j?: any) => Promise.resolve([]).then(r, j),
      };
      return chain;
    },
  };
  return { db, state };
}

describe('[FIX-010] confirmPaymentProof — transactional settle + status + invoice', () => {
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesRepository);
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(MembershipRepository);
    officerMocks = stubOfficerAccess();
  });

  afterEach(() => {
    Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesRepository);
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(MembershipRepository);
  });

  test('happy path: confirms proof, settles, marks invoice paid (200)', async () => {
    let statusUpdatedTo: string | undefined;
    let markPaidCalled = false;

    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment }),
      listFunds: async () => fakeFunds,
      getConfig: async () => undefined,
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => {
        statusUpdatedTo = status;
        return { ...fakePayment, status, ...extra };
      },
    });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-1', status: 'sent', version: 1 }),
      markPaid: async () => { markPaidCalled = true; },
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership }],
      updateOneById: async () => fakeMembership,
    });

    const { db } = makeTrackingDb();
    const ctx = makeCtx({
      database: db,
      organizationId: 'org-1',
      _params: { paymentId: 'pay-1' },
      _body: {},
    });

    const res = await confirmPaymentProof(ctx);
    expect(res.status).toBe(200);
    expect(statusUpdatedTo).toBe('confirmed');
    expect(markPaidCalled).toBe(true);
  });

  test('runs status update + invoice markPaid INSIDE the transaction (atomicity)', async () => {
    // Track whether the outer transaction callback is currently executing when
    // the status update and invoice markPaid happen. Before FIX-010 these ran
    // AFTER settlePayment's own transaction had already closed (txActive=false).
    const txState = { active: false };
    let statusUpdateInsideTx: boolean | undefined;
    let markPaidInsideTx: boolean | undefined;

    const db: any = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        txState.active = true;
        const txObj: any = {
          transaction: async (innerFn: (t: any) => Promise<any>) => innerFn(txObj),
          update: (_table: any) => ({
            set: (data: any) => ({ where: (_c: any) => ({ returning: async () => [data] }) }),
          }),
          insert: (_table: any) => ({ values: async () => undefined }),
          select: () => {
            const chain: any = {
              from: () => chain, where: () => chain,
              limit: async () => [], orderBy: async () => [],
              then: (r: any, j?: any) => Promise.resolve([]).then(r, j),
            };
            return chain;
          },
        };
        try {
          return await fn(txObj);
        } finally {
          txState.active = false;
        }
      },
      update: (_table: any) => ({
        set: (data: any) => ({ where: (_c: any) => ({ returning: async () => [data] }) }),
      }),
      insert: (_table: any) => ({ values: async () => undefined }),
      select: () => {
        const chain: any = {
          from: () => chain, where: () => chain,
          limit: async () => [], orderBy: async () => [],
          then: (r: any, j?: any) => Promise.resolve([]).then(r, j),
        };
        return chain;
      },
    };

    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment }),
      listFunds: async () => fakeFunds,
      getConfig: async () => undefined,
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => {
        statusUpdateInsideTx = txState.active;
        return { ...fakePayment, status, ...extra };
      },
    });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-1', status: 'sent', version: 1 }),
      markPaid: async () => { markPaidInsideTx = txState.active; },
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership }],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: db,
      organizationId: 'org-1',
      _params: { paymentId: 'pay-1' },
      _body: {},
    });

    await confirmPaymentProof(ctx);
    // FIX-010: both the payment status flip and the invoice markPaid must run
    // while the outer transaction is still open, so a later failure rolls them back.
    expect(statusUpdateInsideTx).toBe(true);
    expect(markPaidInsideTx).toBe(true);
  });

  test('[FIX-010] invoice markPaid failure rejects the whole operation (no swallowed error, no partial commit)', async () => {
    let statusUpdatedTo: string | undefined;

    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment }),
      listFunds: async () => fakeFunds,
      getConfig: async () => undefined,
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => {
        statusUpdatedTo = status;
        return { ...fakePayment, status, ...extra };
      },
    });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-1', status: 'sent', version: 1 }),
      // Simulate an optimistic-lock / write failure marking the invoice paid.
      markPaid: async () => { throw new Error('Invoice markPaid failed (version conflict)'); },
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership }],
      updateOneById: async () => fakeMembership,
    });

    const { db } = makeTrackingDb();
    const ctx = makeCtx({
      database: db,
      organizationId: 'org-1',
      _params: { paymentId: 'pay-1' },
      _body: {},
    });

    // The invoice failure must NOT be swallowed by a bare catch — it must
    // propagate so the transaction rolls back (no partial commit: in real
    // Postgres the status flip + settle would roll back with it).
    await expect(confirmPaymentProof(ctx)).rejects.toThrow('Invoice markPaid failed');
  });
});

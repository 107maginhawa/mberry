// Real-PG suite for DuesRepository.settleOnlinePayment — the money-correctness
// path. Settling a successful online payment must move payment pending→completed
// AND the invoice generated|sent→paid AND stamp the pay-link token used, all in
// ONE transaction. The first test is the regression for the lost-money bug:
// collected dues must show up in the officer dashboard (getFullDashboardStats),
// which only counts `completed` payments toward totalCollected. The second proves
// idempotency — a webhook redelivery (double settle) is a no-op, never a
// double-charge or double state-transition.
//
// Runs against the shared pg-scratch harness (CREATE TABLE … LIKE … INCLUDING ALL)
// because only real Postgres transaction + FSM semantics can prove atomicity and
// idempotency. FKs are not copied by LIKE, so constant UUIDs for org/person are
// fine and parent rows are not required.

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { DuesRepository } from './dues-payments.repo';
import { duesPayments } from './dues-payments.schema';
import { duesInvoices } from './dues.schema';
import { paymentTokens } from './payment-token.schema';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

const PERSON = '00000000-0000-4000-8000-00000000c001';
const OFFICER = '00000000-0000-4000-8000-00000000d001';

/**
 * Seed a pending online dues_payment, a payable (generated) dues_invoice for the
 * same org/person, and an active pay-link token. Returns their ids. The payment
 * is `pending` so it does NOT yet count toward totalCollected — settlement is what
 * makes the money visible.
 */
async function seedPendingOnlinePayment(
  db: ScratchDb['db'],
  orgId: string,
  opts: { amount: number },
): Promise<{ paymentId: string; tokenId: string; invoiceId: string }> {
  const [invoice] = await db
    .insert(duesInvoices)
    .values({
      membershipId: '00000000-0000-4000-8000-00000000e001',
      personId: PERSON,
      organizationId: orgId,
      invoiceNumber: `INV-${crypto.randomUUID().slice(0, 8)}`,
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      totalAmount: opts.amount,
      currency: 'PHP',
      fundAllocations: [],
      status: 'generated',
    })
    .returning({ id: duesInvoices.id });

  const [payment] = await db
    .insert(duesPayments)
    .values({
      organizationId: orgId,
      personId: PERSON,
      invoiceId: invoice!.id,
      receiptNumber: `RC-${crypto.randomUUID().slice(0, 8)}`,
      amount: opts.amount,
      currency: 'PHP',
      paymentMethod: 'online',
      status: 'pending',
    })
    .returning({ id: duesPayments.id });

  const [token] = await db
    .insert(paymentTokens)
    .values({
      tokenHash: `hash-${crypto.randomUUID()}`,
      personId: PERSON,
      organizationId: orgId,
      amount: opts.amount,
      currency: 'PHP',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      createdByOfficer: OFFICER,
    })
    .returning({ id: paymentTokens.id });

  return { paymentId: payment!.id, tokenId: token!.id, invoiceId: invoice!.id };
}

beforeAll(async () => {
  H = await createScratch(['dues_payment', 'dues_payment_status_history', 'dues_invoice', 'payment_token']);
});

afterAll(async () => {
  await H?.teardown();
});

describe('settleOnlinePayment', () => {
  test('moves payment pending→completed, invoice→paid, in one tx, and reflects in reports', async () => {
    if (!H.dbReachable) return;
    const db = H.db as any;
    const ORG = crypto.randomUUID(); // per-test org isolates the org-scoped aggregates
    const { paymentId, tokenId, invoiceId } = await seedPendingOnlinePayment(db, ORG, { amount: 50000 });
    const duesRepo = new DuesRepository(db);

    // Pre-settle: pending payment contributes nothing to collected revenue.
    const before = await duesRepo.getFullDashboardStats(ORG);
    expect(before.totalCollected).toBe(0);

    const res = await duesRepo.settleOnlinePayment({
      paymentId, tokenId, invoiceId, gatewayEventId: 'evt_1', paidAt: new Date(),
    });
    expect(res.settled).toBe(true);

    // Payment is completed, invoice is paid, token is used.
    const payment = await duesRepo.getPayment(paymentId);
    expect(payment?.status).toBe('completed');
    expect(payment?.paidAt).toBeInstanceOf(Date);
    const [invoiceRow] = await db.select().from(duesInvoices).where(eq(duesInvoices.id, invoiceId));
    expect(invoiceRow.status).toBe('paid');
    expect(invoiceRow.paymentId).toBe(paymentId);
    const [tokenRow] = await db.select().from(paymentTokens).where(eq(paymentTokens.id, tokenId));
    expect(tokenRow.usedAt).toBeInstanceOf(Date);

    // Regression for the lost-money bug: collected dues now show in the dashboard.
    const stats = await duesRepo.getFullDashboardStats(ORG);
    expect(stats.totalCollected).toBeGreaterThanOrEqual(50000);
  });

  test('is idempotent — second settle is a no-op', async () => {
    if (!H.dbReachable) return;
    const db = H.db as any;
    const ORG = crypto.randomUUID(); // per-test org isolates the org-scoped aggregates
    const { paymentId, tokenId, invoiceId } = await seedPendingOnlinePayment(db, ORG, { amount: 50000 });
    const duesRepo = new DuesRepository(db);

    const first = await duesRepo.settleOnlinePayment({
      paymentId, tokenId, invoiceId, gatewayEventId: 'evt_1', paidAt: new Date(),
    });
    expect(first.settled).toBe(true);

    const second = await duesRepo.settleOnlinePayment({
      paymentId, tokenId, invoiceId, gatewayEventId: 'evt_1', paidAt: new Date(),
    });
    expect(second.settled).toBe(false);

    // No double state-transition: still exactly one completed payment for the org.
    const stats = await duesRepo.getFullDashboardStats(ORG);
    expect(stats.totalCollected).toBe(50000);
    expect(stats.paidCount).toBe(1);
  });
});

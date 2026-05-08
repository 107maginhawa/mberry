import type { Context } from 'hono';
import { DuesRepository } from './repos/dues.repo';
import { allocateFunds } from './utils/fund-math';
import { formatReceiptNumber } from './utils/receipt-number';
import { computeNewExpiry } from './utils/expiry-extension';
import type { Session } from '@/types/auth';

export async function recordPayment(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const body = await ctx.req.json();
  const repo = new DuesRepository(db);

  const { organizationId, personId, amount, currency, paymentMethod, referenceNumber, orgCode } = body;

  const recentPayment = await repo.findRecentPaymentForPerson(organizationId, personId);
  const hasConcurrentWarning = !!recentPayment;

  const year = new Date().getFullYear();
  const sequence = await repo.getNextReceiptSequence(organizationId, year);
  const receiptNumber = formatReceiptNumber(orgCode || 'ORG', year, sequence);

  const payment = await repo.createPayment({
    organizationId,
    personId,
    receiptNumber,
    amount,
    currency: currency ?? 'PHP',
    paymentMethod,
    referenceNumber,
    status: 'completed',
    recordedBy: session.user.id,
    paidAt: new Date(),
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  const funds = await repo.listFunds(organizationId);
  if (funds.length > 0) {
    const splits = allocateFunds(amount, funds.map((f) => ({
      fundId: f.id,
      percentage: parseFloat(f.percentage),
    })));
    await repo.createFundAllocations(
      splits.map((s) => ({
        paymentId: payment.id,
        fundId: s.fundId,
        amount: s.amount,
        isReversal: false,
        organizationId,
      }))
    );
  }

  // [BR-07] Extend dues_expiry_date on payment
  const repoAny = repo as any;
  if (repoAny.getMembershipForExpiry && repoAny.updateDuesExpiry) {
    const membership = await repoAny.getMembershipForExpiry(organizationId, personId);
    if (membership) {
      const newExpiry = computeNewExpiry({
        currentExpiry: membership.duesExpiryDate,
        billingCycle: membership.billingCycle ?? 'annual',
        customMonths: membership.customMonths ?? undefined,
      });
      await repoAny.updateDuesExpiry(organizationId, personId, newExpiry);
    }
  }

  return ctx.json({
    data: payment,
    meta: { concurrentWarning: hasConcurrentWarning, recentPayment },
  }, 201);
}

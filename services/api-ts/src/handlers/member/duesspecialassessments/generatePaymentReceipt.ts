import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';

/**
 * generatePaymentReceipt
 *
 * Generates a payment receipt HTML document for a completed dues payment.
 * Includes org branding, receipt number, payment details, and fund allocations.
 *
 * Position-restricted: TREASURER or PRESIDENT can download any receipt.
 * Members can download their own receipts only.
 */
export async function generatePaymentReceipt(
  ctx: ValidatedContext<never, never, any>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const paymentId = (params as Record<string, string>)['paymentId']!;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const payment = await repo.getPayment(paymentId);
  if (!payment) throw new NotFoundError('Payment not found');

  // Org scoping: payment must belong to this org
  if (payment.organizationId !== orgId) throw new ForbiddenError();

  // Permission check: officers can access any receipt, members only their own
  const isOwnPayment = payment.personId === user.id;
  if (!isOwnPayment) {
    const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
    if (denied) return denied;
  }

  // Get fund allocations for this payment
  const fundAllocations = await repo.getFundAllocations(paymentId);

  // Get org config for branding
  const config = await repo.getConfig(orgId);

  const html = renderReceiptHtml({
    receiptNumber: payment.receiptNumber,
    amount: payment.amount,
    currency: payment.currency,
    paymentMethod: payment.paymentMethod,
    referenceNumber: payment.referenceNumber,
    paidAt: payment.paidAt,
    membershipExtendedFrom: payment.membershipExtendedFrom,
    membershipExtendedTo: payment.membershipExtendedTo,
    fundAllocations: fundAllocations.map(a => ({
      amount: a.amount,
      fundId: a.fundId,
    })),
    organizationId: orgId,
    orgCurrency: config?.currency ?? 'PHP',
  });

  return ctx.json({
    html,
    contentType: 'text/html',
    receiptNumber: payment.receiptNumber,
    paymentId: payment.id,
  }, 200);
}

// ─── Receipt HTML Renderer ────────────────────────────────

interface ReceiptData {
  receiptNumber: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  referenceNumber: string | null;
  paidAt: Date | null;
  membershipExtendedFrom: string | null;
  membershipExtendedTo: string | null;
  fundAllocations: { amount: number; fundId: string }[];
  organizationId: string;
  orgCurrency: string;
}

export function renderReceiptHtml(data: ReceiptData): string {
  const formattedAmount = formatCurrency(data.amount, data.currency);
  const formattedDate = data.paidAt
    ? new Date(data.paidAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';

  const allocationsHtml = data.fundAllocations.length > 0
    ? data.fundAllocations.map(a =>
        `<tr><td>${a.fundId}</td><td style="text-align:right">${formatCurrency(a.amount, data.currency)}</td></tr>`
      ).join('\n')
    : '<tr><td colspan="2">No fund allocations</td></tr>';

  const extensionHtml = data.membershipExtendedTo
    ? `<div class="extension">
        <strong>Membership Extended:</strong>
        ${data.membershipExtendedFrom ?? 'N/A'} &rarr; ${data.membershipExtendedTo}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payment Receipt ${data.receiptNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
    .receipt-number { font-size: 1.2em; color: #666; }
    .details { margin: 20px 0; }
    .details table { width: 100%; border-collapse: collapse; }
    .details td { padding: 8px; border-bottom: 1px solid #eee; }
    .details td:first-child { font-weight: bold; width: 40%; }
    .allocations { margin: 20px 0; }
    .allocations table { width: 100%; border-collapse: collapse; }
    .allocations th, .allocations td { padding: 8px; border-bottom: 1px solid #eee; }
    .allocations th { text-align: left; background: #f5f5f5; }
    .total { font-size: 1.3em; font-weight: bold; text-align: center; margin: 20px 0; }
    .extension { background: #e8f5e9; padding: 10px; border-radius: 4px; margin: 10px 0; }
    .footer { text-align: center; font-size: 0.85em; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Payment Receipt</h1>
    <div class="receipt-number">${data.receiptNumber}</div>
  </div>

  <div class="total">${formattedAmount}</div>

  <div class="details">
    <table>
      <tr><td>Date</td><td>${formattedDate}</td></tr>
      <tr><td>Payment Method</td><td>${data.paymentMethod}</td></tr>
      ${data.referenceNumber ? `<tr><td>Reference</td><td>${data.referenceNumber}</td></tr>` : ''}
      <tr><td>Currency</td><td>${data.currency}</td></tr>
    </table>
  </div>

  ${extensionHtml}

  <div class="allocations">
    <h3>Fund Allocations</h3>
    <table>
      <thead><tr><th>Fund</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${allocationsHtml}</tbody>
    </table>
  </div>

  <div class="footer">
    <p>This is an official receipt generated by the organization.</p>
    <p>Organization ID: ${data.organizationId}</p>
  </div>
</body>
</html>`;
}

function formatCurrency(amount: number, currency: string): string {
  // Amount is stored in minor units (centavos/cents)
  const major = (amount / 100).toFixed(2);
  return `${currency} ${major}`;
}

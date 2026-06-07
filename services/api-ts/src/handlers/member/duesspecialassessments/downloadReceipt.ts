import type { Context } from 'hono';
import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import type { DuesPayment } from '@/handlers/association:member/repos/dues-payments.schema';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import type { Session } from '@/types/auth';

const RECEIPT_ELIGIBLE_STATUSES = ['completed', 'confirmed'];

function renderReceiptHtml(p: DuesPayment): string {
  const amountFormatted = (p.amount / 100).toLocaleString('en-PH', {
    style: 'currency',
    currency: p.currency || 'PHP',
  });

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Receipt ${p.receiptNumber}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
  .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 24px; }
  .receipt-number { font-size: 1.2em; font-weight: bold; color: #333; }
  .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
  .amount { font-size: 1.5em; font-weight: bold; text-align: center; margin: 24px 0; }
  .footer { margin-top: 32px; text-align: center; font-size: 0.85em; color: #666; }
</style>
</head>
<body>
  <div class="header">
    <h1>Payment Receipt</h1>
    <div class="receipt-number">${p.receiptNumber}</div>
  </div>
  <div class="amount">${amountFormatted}</div>
  <div class="detail-row"><span>Payment Method</span><span>${p.paymentMethod}</span></div>
  <div class="detail-row"><span>Status</span><span>${p.status}</span></div>
  <div class="detail-row"><span>Date</span><span>${p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'N/A'}</span></div>
  ${p.referenceNumber ? `<div class="detail-row"><span>Reference</span><span>${p.referenceNumber}</span></div>` : ''}
  <div class="footer">
    <p>This is an electronically generated receipt.</p>
    <p>Generated on ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>`;
}

export async function downloadReceipt(ctx: Context): Promise<Response> {
  const session = ctx.get('session') as Session;
  if (!session) throw new UnauthorizedError();

  const paymentId = ctx.req.param('paymentId')!;
  const organizationId = ctx.req.param('organizationId')!;

  const db = ctx.get('database');
  const repo = new DuesRepository(db);

  const payment = await repo.getPayment(paymentId);
  if (!payment) throw new NotFoundError('Payment not found');

  // Auth: member can access own, officers can access any in org
  const isOwn = payment.personId === session.user.id;
  if (!isOwn) {
    const officerRepo = new OfficerTermRepository(db);
    const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, organizationId);
    if (terms.length === 0) {
      throw new ForbiddenError('Officer access required to view other member receipts');
    }
  }

  // Only completed/confirmed payments have receipts
  if (!RECEIPT_ELIGIBLE_STATUSES.includes(payment.status)) {
    throw new BusinessLogicError(
      'Receipt is only available for completed payments',
      'RECEIPT_NOT_AVAILABLE',
    );
  }

  const html = renderReceiptHtml(payment);

  ctx.set('auditResourceId', paymentId);
  ctx.set('auditDescription', `Receipt downloaded for payment ${payment.receiptNumber}`);

  return ctx.json({
    receiptNumber: payment.receiptNumber,
    html,
    contentType: 'text/html',
  }, 200);
}

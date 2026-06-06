import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { DuesRepository } from './repos/dues-payments.repo';
import { formatReceiptNumber } from './utils/receipt-number';
import { settlePayment } from './utils/settle-payment';

/**
 * bulkRecordPayments (Slice 044)
 *
 * Record manual payments for multiple members at once.
 * Treasurer enters batch payments (e.g., after a chapter meeting where
 * multiple members pay cash). Each row is independently validated and
 * processed — partial failures don't roll back successful entries.
 *
 * Position-restricted: caller must have TREASURER or PRESIDENT position.
 */

interface BulkPaymentRow {
  personId: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  currency?: string;
}

interface BulkPaymentResult {
  personId: string;
  status: 'success' | 'error';
  paymentId?: string;
  receiptNumber?: string;
  error?: string;
}

export async function bulkRecordPayments(
  ctx: ValidatedContext<any, never, never>,
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const session = ctx.get('session');
  const body = ctx.req.valid('json');

  if (!body.payments || !Array.isArray(body.payments) || body.payments.length === 0) {
    return ctx.json({ error: 'payments array is required and must not be empty' }, 400);
  }

  // Cap batch size
  const MAX_BATCH_SIZE = 50;
  if (body.payments.length > MAX_BATCH_SIZE) {
    return ctx.json({ error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);
  const recordedBy = session?.user?.id ?? user.id;

  // Per-row validation
  const validationErrors: BulkPaymentResult[] = [];
  const validPayments: (BulkPaymentRow & { index: number })[] = [];

  for (let i = 0; i < body.payments.length; i++) {
    const row: BulkPaymentRow = body.payments[i];
    const rowErrors: string[] = [];

    if (!row.personId) rowErrors.push('personId is required');
    if (!row.amount || row.amount <= 0) rowErrors.push('amount must be positive');
    if (!row.paymentMethod) rowErrors.push('paymentMethod is required');

    if (rowErrors.length > 0) {
      validationErrors.push({
        personId: row.personId ?? `row-${i}`,
        status: 'error',
        error: rowErrors.join('; '),
      });
    } else {
      validPayments.push({ ...row, index: i });
    }
  }

  const results: BulkPaymentResult[] = [...validationErrors];

  // Process valid payments sequentially (each needs unique receipt number)
  const year = new Date().getFullYear();

  for (const row of validPayments) {
    try {
      const { payment, receiptNumber } = await db.transaction(async (txDb: DatabaseInstance) => {
        const txRepo = new DuesRepository(txDb);

        // Generate receipt inside tx to prevent race condition duplicates
        const sequence = await txRepo.getNextReceiptSequence(orgId, year);
        const rcptNumber = formatReceiptNumber('ORG', year, sequence);

        const pay = await txRepo.createPayment({
          organizationId: orgId,
          personId: row.personId,
          receiptNumber: rcptNumber,
          amount: row.amount,
          currency: row.currency ?? 'PHP',
          paymentMethod: row.paymentMethod as 'cash' | 'check' | 'bankTransfer' | 'gcash' | 'online' | 'other',
          referenceNumber: row.referenceNumber ?? null,
          status: 'completed',
          recordedBy,
          paidAt: new Date(),
          createdBy: recordedBy,
          updatedBy: recordedBy,
        });

        // Fund allocation + membership extension
        const settle = await settlePayment({
          db,
          orgId,
          personId: row.personId,
          paymentId: pay.id,
          amount: row.amount,
          tx: txDb,
        });

        if (settle.membershipExtendedTo) {
          await txRepo.updatePaymentStatus(pay.id, pay.status, 'completed', {
            membershipExtendedFrom: settle.membershipExtendedFrom,
            membershipExtendedTo: settle.membershipExtendedTo,
          }, recordedBy);
        }

        return { payment: pay, receiptNumber: rcptNumber };
      });

      results.push({
        personId: row.personId,
        status: 'success',
        paymentId: payment.id,
        receiptNumber,
      });
    } catch (err: any) {
      results.push({
        personId: row.personId,
        status: 'error',
        error: err.message ?? 'Payment processing failed',
      });
    }
  }

  // Sort results back to original order
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  if (successCount > 0) {
    ctx.set('auditResourceId', `batch-${Date.now()}`);
    ctx.set('auditDescription', `Bulk payment recorded: ${successCount} success, ${errorCount} errors`);
    ctx.set('auditDetails', { successCount, errorCount, total: body.payments.length });
  }

  return ctx.json({
    results,
    summary: {
      total: body.payments.length,
      success: successCount,
      errors: errorCount,
    },
  }, successCount > 0 ? 201 : 400);
}

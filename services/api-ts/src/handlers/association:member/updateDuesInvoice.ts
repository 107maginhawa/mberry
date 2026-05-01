import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { UpdateDuesInvoiceBody, UpdateDuesInvoiceParams } from '@/generated/openapi/validators';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateDuesInvoice
 *
 * Path: PATCH /association/member/dues-invoices/{invoiceId}
 * OperationId: updateDuesInvoice
 */
export async function updateDuesInvoice(
  ctx: ValidatedContext<UpdateDuesInvoiceBody, never, UpdateDuesInvoiceParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesInvoiceRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(invoiceId);
  if (!existing) throw new NotFoundError('DuesInvoice');

  const updated = await repo.updateOneById(invoiceId, body as any);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'dues-invoice',
    resourceId: invoiceId,
    description: 'Dues invoice updated',
  });

  return ctx.json(updated, 200);
}

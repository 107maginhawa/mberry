import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DeleteDuesInvoiceParams } from '@/generated/openapi/validators';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { auditAction } from '@/utils/audit';

/**
 * deleteDuesInvoice
 *
 * Path: DELETE /association/member/dues-invoices/{invoiceId}
 * OperationId: deleteDuesInvoice
 */
export async function deleteDuesInvoice(
  ctx: ValidatedContext<never, never, DeleteDuesInvoiceParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesInvoiceRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(invoiceId);
  if (!existing) throw new NotFoundError('DuesInvoice');

  await repo.deleteOneById(invoiceId);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'dues-invoice',
    resourceId: invoiceId,
    description: 'Dues invoice deleted',
  });

  return new Response(null, { status: 204 });
}

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { GetDuesInvoiceParams } from '@/generated/openapi/validators';
import { DuesInvoiceRepository } from './repos/dues.repo';

/**
 * getDuesInvoice
 *
 * Path: GET /association/member/dues-invoices/{invoiceId}
 * OperationId: getDuesInvoice
 */
export async function getDuesInvoice(
  ctx: ValidatedContext<never, never, GetDuesInvoiceParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesInvoiceRepository(db, ctx.get('logger'));

  const invoice = await repo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('DuesInvoice');

  return ctx.json(invoice, 200);
}

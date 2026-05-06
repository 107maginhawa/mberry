import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { CreateDuesInvoiceBody } from '@/generated/openapi/validators';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { auditAction } from '@/utils/audit';

/**
 * createDuesInvoice
 *
 * Path: POST /association/member/dues-invoices
 * OperationId: createDuesInvoice
 */
export async function createDuesInvoice(
  ctx: ValidatedContext<CreateDuesInvoiceBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DuesInvoiceRepository(db, logger);

  const invoiceNumber = `INV-${Date.now()}`;

  const invoice = await repo.createOne({
    orgId,
    membershipId: body.membershipId,
    personId: body.personId || user.id,
    organizationId: body.organizationId,
    invoiceNumber,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    totalAmount: body.totalAmount,
    fundAllocations: body.fundAllocations || [],
    status: 'generated',
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'dues-invoice',
    resourceId: invoice.id,
    description: 'Dues invoice created',
  });

  return ctx.json(invoice, 201);
}

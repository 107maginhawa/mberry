import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
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
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId') as string;
  if (!orgId) throw new ForbiddenError();

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DuesInvoiceRepository(db, logger);

  const invoiceNumber = `INV-${Date.now()}`;

  const invoice = await repo.createOne({
    organizationId: orgId,
    membershipId: body.membershipId,
    personId: body.personId || session.user.id,
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

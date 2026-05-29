import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import type { CreateDuesInvoiceBody } from '@/generated/openapi/validators';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { domainEvents } from '@/core/domain-events';
import { auditAction } from '@/utils/audit';
import { orgScopedPersonIds } from '@/core/org-scoped-persons';
import { inArray, eq, and } from 'drizzle-orm';
import { persons } from '@/handlers/person/repos/person.schema';

/**
 * createDuesInvoice
 *
 * Path: POST /association/member/dues-invoices
 * OperationId: createDuesInvoice
 */
export async function createDuesInvoice(
  ctx: ValidatedContext<CreateDuesInvoiceBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const orgId = ctx.get('organizationId') as string;
  if (!orgId) throw new ForbiddenError();

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DuesInvoiceRepository(db, logger);

  // [CR-02] If a personId is explicitly supplied, verify it belongs to the
  // caller's org. Without this check, a Treasurer of Org A could attribute
  // invoices to persons in Org B by passing a foreign personId.
  const targetPersonId = body.personId || session.user.id;
  if (body.personId && body.personId !== session.user.id) {
    // Verify the target person is an active member of the caller's org.
    // orgScopedPersonIds returns a subquery of personIds scoped to orgId.
    const scopedIds = orgScopedPersonIds(db, orgId);
    const [match] = await db
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.id, body.personId), inArray(persons.id, scopedIds)))
      .limit(1);
    if (!match) throw new ForbiddenError();
  }

  const invoiceNumber = `INV-${Date.now()}`;

  const invoice = await repo.createOne({
    organizationId: orgId,
    membershipId: body.membershipId,
    personId: targetPersonId,
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
    eventSubType: 'financial.invoice-created',
  });

  domainEvents.emit('dues.invoice.generated', {
    invoiceId: invoice.id,
    organizationId: orgId,
    personId: targetPersonId,
    amount: body.totalAmount,
    dueDate: body.periodEnd,
  }).catch(() => {});

  return ctx.json(invoice, 201);
}

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { assertValidTransition } from '@/utils/status-transitions';
import { INVOICE_VALID_TRANSITIONS } from '@/handlers/member/membership/utils/status-transitions';
import type { DeleteDuesInvoiceParams } from '@/generated/openapi/validators';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';

/**
 * deleteDuesInvoice
 *
 * Path: DELETE /association/member/dues-invoices/{invoiceId}
 * OperationId: deleteDuesInvoice
 */
export async function deleteDuesInvoice(
  ctx: ValidatedContext<never, never, DeleteDuesInvoiceParams>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesInvoiceRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(invoiceId);
  if (!existing) throw new NotFoundError('DuesInvoice');
  const orgId = ctx.get('organizationId') as string;
  if (existing.organizationId !== orgId) throw new ForbiddenError();

  // [S-G1-03 / IC-04] FSM guard: enforce that the current state may transition
  // to 'cancelled' before the soft-delete write. Terminal states (paid,
  // cancelled, writtenOff) cannot be re-cancelled — throws ConflictError(409).
  assertValidTransition(INVOICE_VALID_TRANSITIONS, existing.status, 'cancelled', 'invoice');

  // BR-32: financial records have a 7-year retention requirement (BIR compliance).
  // Never hard-delete — soft-delete by transitioning the invoice to the terminal
  // 'cancelled' state so the row is preserved for the audit/retention window.
  await repo.updateOneById(invoiceId, {
    status: 'cancelled',
    updatedBy: session.user.id,
  } as Partial<typeof existing>);

  ctx.set('auditResourceId', invoiceId);
  ctx.set('auditDescription', 'Dues invoice soft-deleted (cancelled) — BR-32 7-year retention');

  return new Response(null, { status: 204 });
}

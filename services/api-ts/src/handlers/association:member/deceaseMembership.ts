import type { ValidatedContext } from '@/types/app';
import type { BetterAuthInternalApi } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { DeceaseMembershipBody, DeceaseMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';
import { withComputedStatus } from './utils/membership-status-middleware';
import type { Membership } from './repos/membership.schema';
import { duesInvoices } from './repos/dues.schema';
import { INVOICE_VALID_TRANSITIONS } from './utils/status-transitions';
import { isValidTransition } from '@/utils/status-transitions';
import { domainEvents } from '@/core/domain-events';
import { eq, and, inArray } from 'drizzle-orm';

// [S-G1-03 / IC-04] Derive the FSM-permitted set of "from" statuses that
// may transition to 'cancelled'. Cascade filters silently — already-terminal
// invoices are skipped, not raised as errors.
type DuesInvoiceStatus = typeof duesInvoices.status.enumValues[number];
const INVOICE_STATUSES_CANCELABLE: DuesInvoiceStatus[] = (
  Object.keys(INVOICE_VALID_TRANSITIONS).filter(
    (from) => isValidTransition(INVOICE_VALID_TRANSITIONS, from, 'cancelled'),
  ) as DuesInvoiceStatus[]
);

const TERMINAL_STATUSES = ['resigned', 'deceased', 'expelled', 'removed'];

/**
 * deceaseMembership
 *
 * Path: POST /association/member/memberships/{membershipId}/deceased
 * OperationId: deceaseMembership
 */
export async function deceaseMembership(
  ctx: ValidatedContext<DeceaseMembershipBody, never, DeceaseMembershipParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { membershipId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const membership = await repo.findOneById(membershipId);
  if (!membership) throw new NotFoundError('Membership');
  const enriched = withComputedStatus(membership);

  if (TERMINAL_STATUSES.includes(enriched.status)) {
    throw new BusinessLogicError(
      'Membership is already in a terminal state.',
      'ALREADY_TERMINAL',
    );
  }

  let updated!: Membership;
  await db.transaction(async (tx: DatabaseInstance) => {
    // Update membership status with dateOfDeath
    updated = await repo.updateOneById(membershipId, {
      status: 'deceased',
      removedAt: new Date(),
      dateOfDeath: body.dateOfDeath,
      removalReason: body.terminationReason ?? null,
    } as Partial<Membership>);

    // Void open invoices in same transaction. The status filter is derived
    // from INVOICE_VALID_TRANSITIONS so it stays in sync with the FSM — only
    // invoices whose current status admits a 'cancelled' transition are touched.
    await tx.update(duesInvoices)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(duesInvoices.membershipId, membershipId),
          inArray(duesInvoices.status, INVOICE_STATUSES_CANCELABLE),
        ),
      );
  });

  ctx.set('auditResourceId', membershipId);
  ctx.set('auditDescription', `Membership marked deceased (date of death: ${body.dateOfDeath})${body.terminationReason ? `: ${body.terminationReason}` : ''}`);

  // Cross-module visibility: marking deceased is a terminal status change.
  domainEvents.emit('membership.status.changed', {
    membershipId,
    personId: membership.personId ?? '',
    organizationId: membership.organizationId,
    oldStatus: enriched.status,
    newStatus: 'deceased',
  }).catch(() => {});

  // P1-4: Revoke departed member's sessions so they can't access org resources
  try {
    const auth = ctx.get('auth');
    if (auth && membership.personId) {
      await (auth.api as unknown as BetterAuthInternalApi).revokeUserSessions({
        body: { userId: membership.personId },
        headers: ctx.req.raw.headers,
      });
    }
  } catch (err) {
    const baseLogger = ctx.get('logger');
    const traceId = ctx.get('requestId');
    const logger = baseLogger?.child?.({ traceId, module: 'association:member' }) ?? baseLogger;
    logger?.warn({ action: 'deceaseMembership.1', error: err, personId: membership.personId }, 'Failed to revoke sessions after marking membership deceased');
  }

  return ctx.json(updated, 200);
}

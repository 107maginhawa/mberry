import type { ValidatedContext } from '@/types/app';
import type { BetterAuthInternalApi } from '@/types/auth';
import type { Membership } from '@/handlers/association:member/repos/membership.schema';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { ResignMembershipBody, ResignMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { membershipStatusHistory } from '@/handlers/association:member/repos/status-history.schema';
import { withComputedStatus } from './utils/membership-status-middleware';
import { assertRecordInCallerOrg } from './utils/assert-record-org';
import { duesInvoices } from '@/handlers/association:member/repos/dues.schema';
import { INVOICE_VALID_TRANSITIONS } from './utils/status-transitions';
import { isValidTransition } from '@/utils/status-transitions';
import { domainEvents } from '@/core/domain-events';
import { eq, and, inArray } from 'drizzle-orm';

// [S-G1-03 / IC-04] Derive the FSM-permitted set of "from" statuses that
// may transition to 'cancelled'. Cascade filters silently — already-terminal
// invoices are skipped, not raised as errors.
// Typed as the schema's enum union via the column's underlying inferType.
type DuesInvoiceStatus = typeof duesInvoices.status.enumValues[number];
const INVOICE_STATUSES_CANCELABLE: DuesInvoiceStatus[] = (
  Object.keys(INVOICE_VALID_TRANSITIONS).filter(
    (from) => isValidTransition(INVOICE_VALID_TRANSITIONS, from, 'cancelled'),
  ) as DuesInvoiceStatus[]
);

const TERMINAL_STATUSES = ['resigned', 'deceased', 'expelled', 'removed'];

/**
 * resignMembership
 *
 * Path: POST /association/member/memberships/{membershipId}/resign
 * OperationId: resignMembership
 */
export async function resignMembership(
  ctx: ValidatedContext<ResignMembershipBody, never, ResignMembershipParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { membershipId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const membership = await repo.findOneById(membershipId);
  if (!membership) throw new NotFoundError('Membership');
  // FIX-003 (G-02): the record must belong to the caller's org.
  assertRecordInCallerOrg(ctx, membership.organizationId, 'this membership');
  const enriched = withComputedStatus(membership);

  if (TERMINAL_STATUSES.includes(enriched.status)) {
    throw new BusinessLogicError(
      'Membership is already in a terminal state.',
      'ALREADY_TERMINAL',
    );
  }

  let updated!: Membership;
  await db.transaction(async (tx: DatabaseInstance) => {
    // Update membership status. FIX-007: stamp resignedAt (NOT removedAt) so a
    // recompute (cron/read path) keeps the status 'resigned' instead of decaying
    // to 'removed'. resignedAt outranks removedAt in computeMembershipStatus.
    updated = await repo.updateOneById(membershipId, {
      status: 'resigned',
      resignedAt: new Date(),
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

    // FIX-006 / G-08: record the officer-initiated transition for the audit
    // trail (spec §7). Same transaction so history is atomic with the status
    // change. fromStatus is the COMPUTED status before the change, not the cache.
    if (membership.personId) {
      await tx.insert(membershipStatusHistory).values({
        organizationId: membership.organizationId,
        membershipId,
        personId: membership.personId,
        fromStatus: enriched.status,
        toStatus: 'resigned',
        reason: body.terminationReason ?? 'resigned',
        changedBy: session.user.id,
        changedAt: new Date(),
      });
    }
  });

  ctx.set('auditResourceId', membershipId);
  ctx.set('auditDescription', `Membership resigned${body.terminationReason ? `: ${body.terminationReason}` : ''}`);

  // Cross-module visibility: a resignation is a terminal status change.
  domainEvents.emit('membership.status.changed', {
    membershipId,
    personId: membership.personId ?? '',
    organizationId: membership.organizationId,
    oldStatus: enriched.status,
    newStatus: 'resigned',
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
    logger?.warn({ action: 'resignMembership.1', error: err, personId: membership.personId }, 'Failed to revoke sessions after membership resignation');
  }

  return ctx.json(updated, 200);
}

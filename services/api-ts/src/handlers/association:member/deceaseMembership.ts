import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { DeceaseMembershipBody, DeceaseMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';
import type { Membership } from './repos/membership.schema';
import { duesInvoices } from './repos/dues.schema';
import { auditAction } from '@/utils/audit';
import { eq, and, notInArray } from 'drizzle-orm';

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

  if (TERMINAL_STATUSES.includes(membership.status)) {
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

    // Void open invoices in same transaction
    await (tx as any).update(duesInvoices)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(duesInvoices.membershipId, membershipId),
          notInArray(duesInvoices.status, ['paid', 'cancelled', 'writtenOff']),
        ),
      );
  });

  await auditAction(ctx, {
    action: 'deceased',
    resourceType: 'membership',
    resourceId: membershipId,
    description: `Membership marked deceased (date of death: ${body.dateOfDeath})${body.terminationReason ? `: ${body.terminationReason}` : ''}`,
  });

  // P1-4: Revoke departed member's sessions so they can't access org resources
  try {
    const auth = ctx.get('auth');
    if (auth && membership.personId) {
      await (auth.api as any).revokeUserSessions({
        body: { userId: membership.personId },
        headers: ctx.req.raw.headers,
      });
    }
  } catch (err) {
    const logger = ctx.get('logger');
    logger?.warn({ error: err, personId: membership.personId }, 'Failed to revoke sessions after marking membership deceased');
  }

  return ctx.json(updated, 200);
}

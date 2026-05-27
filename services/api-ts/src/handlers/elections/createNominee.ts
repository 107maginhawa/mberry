/**
 * [BR-34] Nomination Eligibility
 *
 * Enforces three mandatory conditions before a nominee can be added:
 * 1. Active membership in the organization at nomination time
 * 2. Minimum 6-month membership tenure (configurable per association)
 * 3. Not suspended in ANY organization within the association
 */

import type { Context } from 'hono';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { NotFoundError, ConflictError, ValidationError, BusinessLogicError } from '@/core/errors';
import { ElectionsRepository } from './repos/elections.repo';
import { memberships } from '../association:member/repos/membership.schema';
import { domainEvents } from '@/core/domain-events';
import type { Session } from '@/types/auth';

const createNomineeSchema = z.object({
  positionId: z.string().uuid('positionId must be a valid UUID'),
  personId: z.string().uuid('personId must be a valid UUID'),
  minMembershipMonths: z.number().int().min(1).default(6).optional(),
});

function monthsBetween(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

export async function createNominee(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const electionId = ctx.req.param('id')!;
  const raw = await ctx.req.json();
  const parsed = createNomineeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((e: { message: string }) => e.message).join('; '));
  }
  const body = parsed.data;
  const minMembershipMonths = body.minMembershipMonths ?? 6;

  const repo = new ElectionsRepository(db);

  // Load the election to get org context
  const election = await repo.get(electionId);
  if (!election) throw new NotFoundError('Election not found');
  if (election.status !== 'nominationsOpen') {
    throw new ConflictError('Nominations are not open for this election');
  }

  const orgId = election.organizationId;
  const nomineePersonId = body.personId;
  const nominationDate = new Date();

  // ─── BR-34 Condition 1: Active membership in this org ─────────────────────
  const [activeMembership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.personId, nomineePersonId),
        eq(memberships.organizationId, orgId),
        eq(memberships.status, 'active'),
      ),
    )
    .limit(1);

  if (!activeMembership) {
    throw new BusinessLogicError(
      'Nominee must be an active member of the organization',
      'NOMINEE_NOT_ACTIVE',
    );
  }

  // ─── BR-34 Condition 2: Minimum tenure (6 months by default) ──────────────
  const memberSince = new Date(activeMembership.joinedAt);
  const monthsAsMember = monthsBetween(memberSince, nominationDate);
  if (monthsAsMember < minMembershipMonths) {
    throw new BusinessLogicError(
      `Nominee must have been a member for at least ${minMembershipMonths} months (current: ${monthsAsMember})`,
      'NOMINEE_INSUFFICIENT_TENURE',
    );
  }

  // ─── BR-34 Condition 3: Not suspended in ANY org ──────────────────────────
  const [suspendedRecord] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.personId, nomineePersonId),
        eq(memberships.status, 'suspended'),
      ),
    )
    .limit(1);

  if (suspendedRecord) {
    throw new BusinessLogicError(
      'Nominee cannot be suspended in any organization',
      'NOMINEE_SUSPENDED',
    );
  }

  // ─── All checks passed — create the nominee ────────────────────────────────
  const nominee = await repo.addNominee({
    electionId,
    positionId: body.positionId,
    personId: nomineePersonId,
    nominatedBy: session.user.id,
    organizationId: orgId,
  });

  domainEvents.emit('nomination.submitted', {
    nomineeId: nominee.id,
    electionId,
    personId: nomineePersonId,
    positionId: body.positionId,
    organizationId: orgId,
  }).catch(() => {});

  return ctx.json({ data: nominee }, 201);
}

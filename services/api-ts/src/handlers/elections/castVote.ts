import type { Context } from 'hono';
import { z } from 'zod';
import { NotFoundError, ConflictError, ValidationError, BusinessLogicError } from '@/core/errors';
import { ElectionsRepository } from './repos/elections.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';
import { computeMembershipStatus } from '../association:member/utils/compute-membership-status';
import type { Session } from '@/types/auth';

const castVoteSchema = z.object({
  positionId: z.string().uuid('positionId must be a valid UUID'),
  nomineeId: z.string().uuid('nomineeId must be a valid UUID'),
});

export async function castVote(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const electionId = ctx.req.param('id')!;
  const raw = await ctx.req.json();
  const parsed = castVoteSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((e: { message: string }) => e.message).join('; '));
  }
  const body = parsed.data;
  const repo = new ElectionsRepository(db);

  const election = await repo.get(electionId);
  if (!election) throw new NotFoundError('Election not found');
  if (election.status !== 'votingOpen') throw new ConflictError('Voting is not open');

  // BR-33: Voter must be active member of the org
  const membershipRepo = new MembershipRepository(db);
  const membership = await membershipRepo.findByPersonAndOrg(
    session.user.id,
    election.organizationId,
  );
  if (!membership) {
    throw new BusinessLogicError(
      'You must be a member of this organization to vote',
      'NOT_ORG_MEMBER',
    );
  }
  const voterStatus = computeMembershipStatus({
    duesExpiryDate: membership.duesExpiryDate,
    gracePeriodDays: membership.gracePeriodDays,
    suspendedAt: membership.suspendedAt,
    removedAt: membership.removedAt,
  });
  if (voterStatus !== 'active') {
    throw new BusinessLogicError(
      `Voting requires active membership. Current status: '${voterStatus}'`,
      'VOTER_NOT_ACTIVE',
    );
  }

  const alreadyVoted = await repo.hasVoted(electionId, session.user.id, body.positionId);
  if (alreadyVoted) throw new ConflictError('Already voted for this position');

  let vote;
  try {
    vote = await repo.castVote({
      electionId,
      positionId: body.positionId,
      nomineeId: body.nomineeId,
      voterId: session.user.id,
      organizationId: election.organizationId,
    });
  } catch (error: unknown) {
    // Catch unique constraint violation (race condition: concurrent vote passed hasVoted check)
    const dbError = error as { code?: string };
    if (dbError.code === '23505') {
      throw new ConflictError('Already voted for this position');
    }
    throw error;
  }

  return ctx.json({ data: vote }, 201);
}

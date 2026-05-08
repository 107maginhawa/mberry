import type { Context } from 'hono';
import { z } from 'zod';
import { NotFoundError, ConflictError, ValidationError } from '@/core/errors';
import { ElectionsRepository } from './repos/elections.repo';
import type { Session } from '@/types/auth';

const castVoteSchema = z.object({
  positionId: z.string().uuid('positionId must be a valid UUID'),
  nomineeId: z.string().uuid('nomineeId must be a valid UUID'),
});

export async function castVote(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const electionId = ctx.req.param('id');
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

  const alreadyVoted = await repo.hasVoted(electionId, session.user.id, body.positionId);
  if (alreadyVoted) throw new ConflictError('Already voted for this position');

  const vote = await repo.castVote({
    electionId,
    positionId: body.positionId,
    nomineeId: body.nomineeId,
    voterId: session.user.id,
    organizationId: election.organizationId,
  });

  return ctx.json({ data: vote }, 201);
}

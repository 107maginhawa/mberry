import type { Context } from 'hono';
import { NotFoundError, ConflictError } from '@/core/errors';
import { ElectionsRepository } from './repos/elections.repo';
import type { Session } from '@/types/auth';

export async function castVote(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const electionId = ctx.req.param('id');
  const body = await ctx.req.json();
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
  });

  return ctx.json({ data: vote }, 201);
}

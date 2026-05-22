import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { ElectionsRepository } from './repos/elections.repo';

export async function getElection(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const repo = new ElectionsRepository(db);
  const election = await repo.get(id);
  if (!election) throw new NotFoundError('Election not found');
  const nominees = await repo.listNominees(id);
  const voterCount = await repo.getVoterCount(id);
  const tallies = election.status === 'awaitingConfirmation' || election.status === 'published' ? await repo.getVoteTallies(id) : [];
  return ctx.json({ data: {
    ...election,
    // Map DB → TypeSpec field names for SDK transformer
    nominationStart: election.nominationsOpenAt,
    nominationEnd: election.nominationsCloseAt,
    votingStart: election.votingOpenAt,
    votingEnd: election.votingCloseAt,
    nominees,
    voterCount,
    tallies,
  } }, 200);
}

import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '@/core/errors';
import { ElectionsRepository } from './repos/elections.repo';
import { persons } from '../person/repos/person.schema';

export async function getElection(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const repo = new ElectionsRepository(db);
  const election = await repo.get(id);
  if (!election) throw new NotFoundError('Election not found');
  const nominees = await repo.listNominees(id);
  const voterCount = await repo.getVoterCount(id);
  const tallies = election.status === 'awaitingConfirmation' || election.status === 'published' ? await repo.getVoteTallies(id) : [];

  // Enrich nominees with person names (best-effort)
  let enrichedNominees: Array<typeof nominees[number] & { personName?: string }> = nominees;
  try {
    const personIds = [...new Set(nominees.map(n => n.personId))];
    const personMap = new Map<string, { firstName: string; lastName?: string | null }>();
    for (const pid of personIds) {
      const [person] = await db.select({ firstName: persons.firstName, lastName: persons.lastName }).from(persons).where(eq(persons.id, pid)).limit(1);
      if (person) personMap.set(pid, person);
    }
    enrichedNominees = nominees.map(n => {
      const person = personMap.get(n.personId);
      return { ...n, personName: person ? `${person.firstName}${person.lastName ? ' ' + person.lastName : ''}` : undefined };
    });
  } catch {
    enrichedNominees = nominees;
  }

  return ctx.json({ data: {
    ...election,
    nominationStart: election.nominationsOpenAt,
    nominationEnd: election.nominationsCloseAt,
    votingStart: election.votingOpenAt,
    votingEnd: election.votingCloseAt,
    nominees: enrichedNominees,
    voterCount,
    tallies,
  } }, 200);
}

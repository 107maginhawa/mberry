import type { Context } from 'hono';
import { ForbiddenError, UnauthorizedError } from '@/core/errors';
import { ElectionsRepository } from './repos/elections.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';
import type { Session } from '@/types/auth';

export async function createElection(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.req.param('organizationId');
  const body = await ctx.req.json();

  // Officer authorization — only officers can create elections
  const officerRepo = new OfficerTermRepository(db);
  const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, orgId!);
  if (terms.length === 0) {
    throw new ForbiddenError('Officer access required to create elections');
  }

  // Use Drizzle ORM repo instead of raw SQL to prevent SQL injection
  const electionRepo = new ElectionsRepository(db);
  const election = await electionRepo.create({
    organizationId: orgId!,
    title: body.title,
    type: ['officer', 'bylaw'].includes(body.type) ? body.type : 'officer',
    status: 'draft',
    votingMode: body.votingMode ?? 'online',
    nominationsOpenAt: body.nominationsOpenAt || null,
    nominationsCloseAt: body.nominationsCloseAt || null,
    votingOpenAt: body.votingOpenAt || null,
    votingCloseAt: body.votingCloseAt || null,
    positions: body.positions || [],
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  domainEvents.emit('election.created', {
    electionId: election.id,
    organizationId: orgId!,
    createdBy: session.user.id,
  }).catch(() => {});

  return ctx.json({ data: election }, 201);
}

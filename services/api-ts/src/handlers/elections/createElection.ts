import type { Context } from 'hono';
import { ElectionsRepository } from './repos/elections.repo';
import type { Session } from '@/types/auth';

export async function createElection(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('orgId');
  const body = await ctx.req.json();
  const repo = new ElectionsRepository(db);

  try {
    const election = await repo.create({
      organizationId: orgId,
      title: body.title,
      type: body.type ?? 'officer',
      votingMode: body.votingMode ?? 'online',
      nominationsOpenAt: body.nominationsOpenAt ? new Date(body.nominationsOpenAt) : undefined,
      nominationsCloseAt: body.nominationsCloseAt ? new Date(body.nominationsCloseAt) : undefined,
      votingOpenAt: body.votingOpenAt ? new Date(body.votingOpenAt) : undefined,
      votingCloseAt: body.votingCloseAt ? new Date(body.votingCloseAt) : undefined,
      passageThreshold: body.passageThreshold,
      positions: body.positions ? JSON.stringify(body.positions) : undefined,
      status: 'draft',
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });

    return ctx.json({ data: election }, 201);
  } catch (err: any) {
    return ctx.json({ error: err.message || 'Failed to create election' }, 500);
  }
}

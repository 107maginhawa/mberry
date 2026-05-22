import type { Context } from 'hono';
import { JobPostingRepository } from './repos/jobs.repo';
import type { Session } from '@/types/auth';

export async function updateJobPosting(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const postingId = ctx.req.param('postingId');
  const body = await ctx.req.json();
  const repo = new JobPostingRepository(db);

  const existing = await repo.get(postingId);
  if (!existing) {
    return ctx.json({ error: 'Posting not found' }, 404);
  }

  const updates: Record<string, any> = { updatedBy: session.user.id };
  if (body.title !== undefined) updates['title'] = body.title;
  if (body.organizationName !== undefined) updates['organizationName'] = body.organizationName;
  if (body.location !== undefined) updates['location'] = body.location;
  if (body.type !== undefined) updates['type'] = body.type;
  if (body.salary !== undefined) updates['salary'] = body.salary;
  if (body.description !== undefined) updates['description'] = body.description;
  if (body.requirements !== undefined) updates['requirements'] = body.requirements;
  if (body.status !== undefined) updates['status'] = body.status;
  if (body.expiresAt !== undefined) updates['expiresAt'] = new Date(body.expiresAt);

  const updated = await repo.update(postingId, updates);
  return ctx.json({ data: updated }, 200);
}

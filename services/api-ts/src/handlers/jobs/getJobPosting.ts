import type { Context } from 'hono';
import { JobPostingRepository } from './repos/jobs.repo';

export async function getJobPosting(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const postingId = ctx.req.param('postingId')!;
  const repo = new JobPostingRepository(db);

  const organizationId = ctx.get('organizationId');
  const posting = await repo.get(postingId);
  // Org-scope: a posting outside the caller's org is treated as missing.
  if (!posting || posting.organizationId !== organizationId) {
    return ctx.json({ error: 'Posting not found' }, 404);
  }

  return ctx.json({ data: posting }, 200);
}

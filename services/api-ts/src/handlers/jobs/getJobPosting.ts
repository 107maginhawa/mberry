import type { Context } from 'hono';
import { JobPostingRepository } from './repos/jobs.repo';

export async function getJobPosting(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const postingId = ctx.req.param('postingId');
  const repo = new JobPostingRepository(db);

  const posting = await repo.get(postingId);
  if (!posting) {
    return ctx.json({ error: 'Posting not found' }, 404);
  }

  return ctx.json({ data: posting }, 200);
}

import type { Context } from 'hono';
import { JobPostingRepository } from './repos/jobs.repo';

export async function deleteJobPosting(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const postingId = ctx.req.param('postingId');
  const repo = new JobPostingRepository(db);

  const existing = await repo.get(postingId);
  if (!existing) {
    return ctx.json({ error: 'Posting not found' }, 404);
  }

  await repo.delete(postingId);
  return ctx.body(null, 204);
}

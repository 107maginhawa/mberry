import type { Context } from 'hono';
import { JobPostingRepository } from './repos/jobs.repo';

export async function deleteJobPosting(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const postingId = ctx.req.param('postingId')!;
  const repo = new JobPostingRepository(db);

  const organizationId = ctx.get('organizationId');
  const existing = await repo.get(postingId);
  // Org-scope: a posting outside the caller's org is treated as missing.
  if (!existing || existing.organizationId !== organizationId) {
    return ctx.json({ error: 'Posting not found' }, 404);
  }

  await repo.delete(postingId);
  return ctx.body(null, 204);
}

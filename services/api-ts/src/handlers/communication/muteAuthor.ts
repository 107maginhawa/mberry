import type { Context } from 'hono';
import { FeedPostRepository } from './repos/feed-post.repo';
import type { Session } from '@/types/auth';

export async function muteAuthor(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId')!;
  const body = await ctx.req.json();

  if (!body.mutedAuthorId) {
    return ctx.json({ error: 'mutedAuthorId is required' }, 400);
  }

  const repo = new FeedPostRepository(db);

  await repo.muteAuthor({
    memberId: session.user.id,
    mutedAuthorId: body.mutedAuthorId,
    organizationId: orgId,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: { success: true } }, 201);
}

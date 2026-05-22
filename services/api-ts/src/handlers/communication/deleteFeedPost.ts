import type { Context } from 'hono';
import { FeedPostRepository } from './repos/feed-post.repo';
import type { Session } from '@/types/auth';
import { auditAction } from '@/utils/audit';

export async function deleteFeedPost(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id');
  const body = await ctx.req.json().catch(() => ({}));

  const repo = new FeedPostRepository(db);
  const post = await repo.get(id);

  if (!post) {
    return ctx.json({ error: 'Feed post not found' }, 404);
  }

  await repo.softDelete(id, session.user.id, body.reason);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'feed-post',
    resourceId: id,
    description: `Feed post removed by ${session.user.id}`,
    details: { reason: body.reason },
  });

  return ctx.json({ data: { success: true } });
}

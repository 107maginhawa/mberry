import type { Context } from 'hono';
import { FeedPostRepository } from './repos/feed-post.repo';
import type { Session } from '@/types/auth';

const AUTO_FLAG_THRESHOLD = 3;

export async function reportFeedPost(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id')!;
  const body = await ctx.req.json().catch(() => ({}));

  const repo = new FeedPostRepository(db);
  const post = await repo.get(id);

  if (!post) {
    return ctx.json({ error: 'Feed post not found' }, 404);
  }

  await repo.addReport({
    postId: id,
    reporterId: session.user.id,
    reason: body.reason ?? null,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  // BR-35: Auto-flag post when report count reaches threshold
  const reportCount = await repo.getReportCount(id);
  if (reportCount >= AUTO_FLAG_THRESHOLD && post.status !== 'flagged' && post.status !== 'removed') {
    await repo.update(id, { status: 'flagged' });
  }

  return ctx.json({ data: { success: true } }, 201);
}

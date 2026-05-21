import type { Context } from 'hono';
import { FeedPostRepository } from './repos/feed-post.repo';

export async function getFeedPost(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');

  const repo = new FeedPostRepository(db);
  const post = await repo.get(id);

  if (!post) {
    return ctx.json({ error: 'Feed post not found' }, 404);
  }

  return ctx.json({ data: post });
}

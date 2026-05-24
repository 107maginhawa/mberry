import type { Context } from 'hono';
import { FeedPostRepository } from './repos/feed-post.repo';

export async function listFeedPosts(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('organizationId')!;
  const limit = Number(ctx.req.query('limit') ?? 20);
  const offset = Number(ctx.req.query('offset') ?? 0);

  const repo = new FeedPostRepository(db);
  const result = await repo.list(orgId, { limit, offset });

  return ctx.json({ data: result.data, total: result.total });
}

import type { Context } from 'hono';
import { FeedPostRepository } from './repos/feed-post.repo';
import type { Session } from '@/types/auth';

const MAX_BODY_LENGTH = 2000;
const MAX_IMAGES = 4;

export async function createFeedPost(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId')!;
  const body = await ctx.req.json();

  if (!body.bodyText || typeof body.bodyText !== 'string') {
    return ctx.json({ error: 'bodyText is required' }, 400);
  }
  if (body.bodyText.length > MAX_BODY_LENGTH) {
    return ctx.json({ error: `bodyText must not exceed ${MAX_BODY_LENGTH} characters` }, 400);
  }
  if (!body.postType) {
    return ctx.json({ error: 'postType is required' }, 400);
  }
  if (body.images && Array.isArray(body.images) && body.images.length > MAX_IMAGES) {
    return ctx.json({ error: `Maximum ${MAX_IMAGES} images per post` }, 400);
  }

  const repo = new FeedPostRepository(db);

  const post = await repo.create({
    organizationId: orgId,
    authorId: session.user.id,
    postType: body.postType,
    bodyText: body.bodyText,
    visibility: body.visibility ?? 'org',
    status: body.status ?? 'published',
    isPinned: body.isPinned ?? false,
    isSponsored: body.isSponsored ?? false,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: post }, 201);
}

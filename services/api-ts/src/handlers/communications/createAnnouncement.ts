import type { Context } from 'hono';
import { CommunicationsRepository } from './repos/communications.repo';
import type { Session } from '@/types/auth';

export async function createAnnouncement(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('orgId');
  const body = await ctx.req.json();
  const repo = new CommunicationsRepository(db);

  const announcement = await repo.create({
    organizationId: orgId,
    authorId: session.user.id,
    title: body.title,
    content: body.content,
    audienceType: body.audienceType ?? 'all',
    audienceCategories: body.audienceCategories,
    channelPush: body.channelPush ?? true,
    channelEmail: body.channelEmail ?? false,
    visibility: body.visibility ?? 'internal',
    status: body.status ?? 'draft',
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    publishedAt: body.status === 'sent' ? new Date() : undefined,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  if (body.status === 'sent') {
    await repo.createStats(announcement.id, body.recipientCount ?? 0);
  }

  return ctx.json({ data: announcement }, 201);
}

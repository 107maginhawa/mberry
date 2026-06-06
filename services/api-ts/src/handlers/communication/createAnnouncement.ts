import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { CreateAnnouncementBody, CreateAnnouncementParams } from '@/generated/openapi/validators';
import type { NewAnnouncement } from './repos/communication.schema';
import { CommunicationsRepository } from './repos/communication.repo';
import { domainEvents } from '@/core/domain-events';

/**
 * createAnnouncement
 *
 * Path: POST /communications/announcements/{orgId}
 * OperationId: createAnnouncement
 */
export async function createAnnouncement(
  ctx: ValidatedContext<CreateAnnouncementBody, never, CreateAnnouncementParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new CommunicationsRepository(db);

  const announcement = await repo.create({
    ...body,
    organizationId: params.organizationId,
    authorId: session.user.id,
    status: 'draft',
  } as NewAnnouncement);

  await domainEvents.emit('announcement.created', {
    announcementId: announcement.id,
    organizationId: params.organizationId,
    createdBy: session.user.id,
    title: announcement.title,
  });

  ctx.set('auditResourceId', announcement.id);
  ctx.set('auditDescription', `Created announcement: ${announcement.title}`);
  ctx.set('auditDetails', { orgId: params.organizationId });

  return ctx.json({ data: announcement }, 201);
}

import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { CreateAnnouncementBody, CreateAnnouncementParams } from '@/generated/openapi/validators';
import { CommunicationsRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

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
  } as any);

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'announcement',
    resourceId: announcement.id,
    description: `Created announcement: ${announcement.title}`,
    details: { orgId: params.organizationId },
  });

  return ctx.json({ data: announcement }, 201);
}

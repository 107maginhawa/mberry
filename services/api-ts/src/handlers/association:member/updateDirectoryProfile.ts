import type { ValidatedContext } from '@/types/app';
import type { DirectoryProfile } from './repos/directory.schema';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateDirectoryProfileBody, UpdateDirectoryProfileParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DirectoryProfileRepository } from './repos/directory.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateDirectoryProfile
 *
 * Path: PATCH /association/member/directory/profiles/{profileId}
 * OperationId: updateDirectoryProfile
 */
export async function updateDirectoryProfile(
  ctx: ValidatedContext<UpdateDirectoryProfileBody, never, UpdateDirectoryProfileParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { profileId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DirectoryProfileRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(profileId);
  if (!existing) throw new NotFoundError('Directory profile');

  const updated = await repo.updateOneById(profileId, {
    ...body,
    lastUpdatedAt: new Date(),
  } as Partial<DirectoryProfile>);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'directory-profile',
    resourceId: profileId,
    description: 'Directory profile updated',
  });

  return ctx.json(updated, 200);
}

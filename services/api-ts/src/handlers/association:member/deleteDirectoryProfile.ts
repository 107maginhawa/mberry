import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteDirectoryProfileParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DirectoryProfileRepository } from './repos/directory.repo';

/**
 * deleteDirectoryProfile
 *
 * Path: DELETE /association/member/directory/profiles/{profileId}
 * OperationId: deleteDirectoryProfile
 */
export async function deleteDirectoryProfile(
  ctx: ValidatedContext<never, never, DeleteDirectoryProfileParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { profileId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DirectoryProfileRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(profileId);
  if (!existing) throw new NotFoundError('Directory profile');

  await repo.deleteOneById(profileId);

  ctx.set('auditResourceId', profileId);
  ctx.set('auditDescription', 'Directory profile deleted');

  return ctx.body(null, 204);
}

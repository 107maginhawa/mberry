import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetDirectoryProfileParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DirectoryProfileRepository } from './repos/directory.repo';

/**
 * getDirectoryProfile
 *
 * Path: GET /association/member/directory/profiles/{profileId}
 * OperationId: getDirectoryProfile
 */
export async function getDirectoryProfile(
  ctx: ValidatedContext<never, never, GetDirectoryProfileParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DirectoryProfileRepository(db, ctx.get('logger'));

  const profile = await repo.findOneById((params as any).profileId);
  if (!profile) throw new NotFoundError('Directory profile');

  return ctx.json(profile, 200);
}

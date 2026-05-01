import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetPublicDirectoryProfileParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { DirectoryProfileRepository } from './repos/directory.repo';

/**
 * getPublicDirectoryProfile
 *
 * Path: GET /association/member/directory/search/{personId}/public
 * OperationId: getPublicDirectoryProfile
 */
export async function getPublicDirectoryProfile(
  ctx: ValidatedContext<never, never, GetPublicDirectoryProfileParams>
): Promise<Response> {
  // Optional authentication - public endpoint
  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DirectoryProfileRepository(db, ctx.get('logger'));

  const profile = await repo.findOne({
    personId: (params as any).personId,
    visibility: 'public',
  });

  if (!profile) throw new NotFoundError('Public directory profile');

  return ctx.json(profile, 200);
}

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetPublicDirectoryProfileParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { DirectoryProfileRepository } from '@/handlers/association:member/repos/directory.repo';

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
  const { personId } = params as { personId: string };
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DirectoryProfileRepository(db, ctx.get('logger'));

  // BR-21: Scope by organizationId to prevent cross-org profile leakage.
  // Without this, a personId from org-A could be returned when browsing org-B.
  const orgId = ctx.get('organizationId');

  const profile = await repo.findOne({
    personId,
    organizationId: orgId,
    visibility: 'public',
  });

  if (!profile) throw new NotFoundError('Public directory profile');

  return ctx.json(profile, 200);
}

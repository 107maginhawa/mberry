import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateDirectoryProfileBody } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { DirectoryProfileRepository } from './repos/directory.repo';
import { auditAction } from '@/utils/audit';

/**
 * createDirectoryProfile
 *
 * Path: POST /association/member/directory/profiles
 * OperationId: createDirectoryProfile
 */
export async function createDirectoryProfile(
  ctx: ValidatedContext<CreateDirectoryProfileBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DirectoryProfileRepository(db, logger);

  const profile = await repo.createOne({
    organizationId: orgId,
    personId: body.personId,
    displayName: body.displayName,
    title: body.title ?? null,
    organization: body.organization ?? null,
    specialty: body.specialty ?? null,
    location: body.location ?? null,
    photoUrl: body.photoUrl ?? null,
    bio: body.bio ?? null,
    contactEmail: body.contactEmail ?? null,
    contactPhone: body.contactPhone ?? null,
    website: body.website ?? null,
    socialLinks: (body.socialLinks as Record<string, string> | null) ?? null,
    visibility: body.visibility ?? 'hidden',
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'directory-profile',
    resourceId: profile.id,
    description: 'Directory profile created',
  });

  return ctx.json(profile, 201);
}

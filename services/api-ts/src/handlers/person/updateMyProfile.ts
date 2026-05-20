import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { UpdateMyProfileBody } from '@/generated/openapi/validators';
import { PersonRepository } from './repos/person.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateMyProfile
 *
 * Path: PATCH /
 * OperationId: updateMyProfile
 */
export async function updateMyProfile(
  ctx: ValidatedContext<UpdateMyProfileBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const body = ctx.req.valid('json');
  const personId = session.user.id;

  const repo = new PersonRepository(db, logger);

  const existing = await repo.findOneById(personId);
  if (!existing) throw new NotFoundError('Person not found');

  const b = body as any;
  const updateData: Record<string, unknown> = { updatedBy: personId };
  if (b['firstName'] !== undefined) updateData['firstName'] = b['firstName'];
  if (b['lastName'] !== undefined) updateData['lastName'] = b['lastName'];
  if (b['middleName'] !== undefined) updateData['middleName'] = b['middleName'];
  if (b['dateOfBirth'] !== undefined) updateData['dateOfBirth'] = b['dateOfBirth'];
  if (b['gender'] !== undefined) updateData['gender'] = b['gender'];
  if (b['contactInfo'] !== undefined) updateData['contactInfo'] = b['contactInfo'];
  if (b['primaryAddress'] !== undefined) updateData['primaryAddress'] = b['primaryAddress'];
  if (b['languagesSpoken'] !== undefined) updateData['languagesSpoken'] = b['languagesSpoken'];
  if (b['timezone'] !== undefined) updateData['timezone'] = b['timezone'];
  if (b['licenseNumber'] !== undefined) updateData['licenseNumber'] = b['licenseNumber'];
  if (b['specialization'] !== undefined) updateData['specialization'] = b['specialization'];
  if (b['prcId'] !== undefined) updateData['prcId'] = b['prcId'];
  if (b['preferredLanguage'] !== undefined) updateData['preferredLanguage'] = b['preferredLanguage'];
  if (b['avatar'] !== undefined) updateData['avatar'] = b['avatar'];

  const updated = await repo.updateOneById(personId, updateData as any);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'person',
    resourceId: personId,
    description: 'Self-service profile update',
  });

  return ctx.json(updated, 200);
}

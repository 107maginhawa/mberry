import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { UpdateMyProfileBody } from '@/generated/openapi/validators';
import { PersonRepository } from './repos/person.repo';
import { domainEvents } from '@/core/domain-events';

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

  // PersonMeUpdateRequest (the generated validator) only carries these fields.
  // Anything else (contactInfo, primaryAddress, languagesSpoken, licenseNumber,
  // prcId, avatar) is stripped by the validator before reaching here, so we map
  // ONLY the contract fields. FIX-005 (G-05): the contract `phone` was never
  // mapped — every PATCH /persons/me with {phone} returned 200 and silently
  // dropped it. Map it into contactInfo.phone, preserving the existing email.
  const b = body as Record<string, unknown>;
  const updateData: Record<string, unknown> = { updatedBy: personId };
  if (b['firstName'] !== undefined) updateData['firstName'] = b['firstName'];
  if (b['lastName'] !== undefined) updateData['lastName'] = b['lastName'];
  if (b['middleName'] !== undefined) updateData['middleName'] = b['middleName'];
  if (b['dateOfBirth'] !== undefined) updateData['dateOfBirth'] = b['dateOfBirth'];
  if (b['gender'] !== undefined) updateData['gender'] = b['gender'];
  if (b['specialization'] !== undefined) updateData['specialization'] = b['specialization'];
  if (b['timezone'] !== undefined) updateData['timezone'] = b['timezone'];
  if (b['preferredLanguage'] !== undefined) updateData['preferredLanguage'] = b['preferredLanguage'];
  if (b['phone'] !== undefined) {
    updateData['contactInfo'] = { ...(existing.contactInfo ?? {}), phone: b['phone'] as string };
  }

  const updated = await repo.updateOneById(personId, updateData as Record<string, unknown>);

  ctx.set('auditResourceId', personId);
  ctx.set('auditDescription', 'Self-service profile update');

  // changedFields excludes the audit-only updatedBy marker
  const updatedFields = Object.keys(updateData).filter((k) => k !== 'updatedBy');
  domainEvents
    .emit('person.updated', { personId, updatedBy: personId, updatedFields })
    .catch(() => {});

  return ctx.json(updated, 200);
}

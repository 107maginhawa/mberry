/**
 * executeAccountDeletion
 *
 * Anonymizes person PII after 30-day grace period expires.
 * Called by a scheduled job or admin action — NOT by the user directly.
 *
 * Per BR-32:
 * - Payment records retained 7 years with anonymized person reference
 * - Person record kept (anonymized) so payment personId FK still resolves
 * - Name, email, phone, address, license, avatar all scrubbed
 *
 * Per DPA 2012:
 * - Personal identifiers removed
 * - Financial/compliance records retained per statutory minimums
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { PersonRepository } from './repos/person.repo';

export async function executeAccountDeletion(
  ctx: ValidatedContext<never, never, never>
): Promise<Response> {
  const personId = ctx.req.param('personId');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PersonRepository(db, logger);

  const person = await repo.findOneById(personId);
  if (!person) return ctx.json({ error: 'Person not found' }, 404);

  // Already deleted
  if (person.deletionCompletedAt) {
    return ctx.json({ error: 'Deletion already completed' }, 410);
  }

  // No deletion requested
  if (!person.deletionRequestedAt || !person.deletionScheduledAt) {
    return ctx.json({ error: 'No deletion request pending' }, 400);
  }

  // Grace period not yet expired
  const now = new Date();
  if (new Date(person.deletionScheduledAt) > now) {
    return ctx.json({ error: 'Grace period has not expired yet' }, 400);
  }

  // Anonymize PII — keep the record but scrub all personal data
  await repo.updateOneById(personId, {
    firstName: 'Deleted',
    lastName: 'User',
    middleName: null,
    contactInfo: null,
    primaryAddress: null,
    avatar: null,
    licenseNumber: null,
    specialization: null,
    prcId: null,
    dateOfBirth: null,
    languagesSpoken: null,
    timezone: null,
    preferredLanguage: null,
    deletionCompletedAt: now,
    updatedBy: 'system',
  });

  // Audit
  const audit = ctx.get('audit');
  if (audit) {
    try {
      await audit.logEvent({
        eventType: 'data-deletion',
        category: 'privacy',
        action: 'anonymize',
        outcome: 'success',
        organizationId: ctx.get('organizationId'),
        user: 'system',
        userType: 'system' as const,
        resourceType: 'person',
        resource: personId,
        description: 'Account anonymized after grace period expiry',
        details: { originalRequestDate: person.deletionRequestedAt },
      });
    } catch (e) {
      logger?.error({ error: e }, 'Failed to log deletion execution audit');
    }
  }

  logger?.info({ personId }, 'Account deletion executed — PII anonymized');

  return ctx.json({ anonymized: true, personId }, 200);
}

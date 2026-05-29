/**
 * executeAccountDeletion
 *
 * Anonymizes person PII after 30-day grace period expires.
 * Called by a scheduled job or admin action — NOT by the user directly.
 *
 * SECURITY NOTE: This handler is NOT HTTP-exposed. It has no route
 * registration in routes.ts or app.ts. It is invoked only by:
 *   - The deletion cron job (deletionProcessor)
 *   - Admin-tier internal calls
 * If this ever gets an HTTP route, it MUST have admin-only auth.
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
import { duesPayments } from '../association:member/repos/dues-payments.schema';
import * as schema from '@/generated/better-auth/schema';
import { eq } from 'drizzle-orm';
import { executeCascadeDeletion } from './accountDeletionCascade';
import { domainEvents } from '@/core/domain-events';

export async function executeAccountDeletion(
  ctx: ValidatedContext<never, never, never>
): Promise<Response> {
  const personId = ctx.req.param('personId')!;
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

  // Kill sessions first — before PII is scrubbed
  await db.delete(schema.session).where(eq(schema.session.userId, personId));

  // Cascade deletion across all modules (flow 6.6)
  const cascadeResult = await executeCascadeDeletion({ db, personId, logger });
  if (cascadeResult.errors > 0) {
    logger?.warn({ personId, cascadeErrors: cascadeResult.errors }, 'Cascade completed with errors');
  }

  // Anonymize PII — keep the record but scrub all personal data
  await repo.updateOneById(personId, {
    firstName: 'DELETED',
    lastName: 'DELETED',
    middleName: null,
    contactInfo: { email: 'deleted@deleted.invalid', phone: undefined },
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

  domainEvents.emit('person.anonymized', { personId }).catch(() => {});

  return ctx.json({ anonymized: true, personId }, 200);
}

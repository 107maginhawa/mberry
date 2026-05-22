/**
 * Deletion Processor
 *
 * Runs daily. Finds persons past their deletionScheduledAt date
 * and anonymizes PII per DPA 2012 right-to-erasure requirements.
 *
 * DPA-06: Scheduled deletion processor
 * DPA-02: Anonymization fields
 * DPA-05: Audit log must not contain PII
 *
 * Idempotent — skips records where deletionCompletedAt is already set.
 * Per-record try/catch ensures one failure doesn't halt the batch.
 */

import type { DatabaseInstance } from '@/core/database';
import { and, isNotNull, isNull, lt, sql, eq } from 'drizzle-orm';
import { persons } from '../repos/person.schema';
import * as schema from '@/generated/better-auth/schema';
import { executeCascadeDeletion } from '../accountDeletionCascade';

interface DeletionContext {
  db: DatabaseInstance;
  logger: any;
  audit?: {
    logEvent: (args: any) => Promise<void>;
  };
}

export interface DeletionResult {
  processed: number;
  succeeded: number;
  errors: number;
}

/**
 * Process all persons past their deletion schedule date.
 * Called by the job scheduler (daily at midnight).
 */
export async function processDeletions(ctx: DeletionContext): Promise<DeletionResult> {
  const { db, logger, audit } = ctx;
  const result: DeletionResult = { processed: 0, succeeded: 0, errors: 0 };

  // Find all persons overdue for deletion
  const pending = await db
    .select({
      id: persons.id,
      deletionRequestedAt: persons.deletionRequestedAt,
    })
    .from(persons)
    .where(
      and(
        isNotNull(persons.deletionScheduledAt),
        lt(persons.deletionScheduledAt, sql`now()`),
        isNull(persons.deletionCompletedAt),
      ),
    );

  for (const person of pending) {
    result.processed++;
    try {
      const now = new Date();

      // Kill sessions before PII scrub — T-19-05
      await db.delete(schema.session).where(eq(schema.session.userId, person.id));

      // Cascade deletion across all modules (flow 6.6)
      const cascadeResult = await executeCascadeDeletion({ db, personId: person.id, logger });
      if (cascadeResult.errors > 0) {
        logger?.warn({ personId: person.id, cascadeErrors: cascadeResult.errors }, 'Cascade completed with errors');
      }

      // Anonymize PII
      await db
        .update(persons)
        .set({
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
        })
        .where(eq(persons.id, person.id));

      // Audit — NO PII in details (DPA-05)
      if (audit) {
        try {
          await audit.logEvent({
            eventType: 'data-deletion',
            category: 'privacy',
            action: 'anonymize',
            outcome: 'success',
            user: 'system',
            userType: 'system' as const,
            resourceType: 'person',
            resource: person.id,
            description: 'Account anonymized by scheduled deletion processor',
            details: {
              personId: person.id,
              originalRequestDate: person.deletionRequestedAt,
            },
          });
        } catch (auditErr) {
          logger?.warn({ error: auditErr, personId: person.id }, 'Failed to log deletion audit');
        }
      }

      result.succeeded++;
      logger?.info({ personId: person.id }, 'Account deletion executed — PII anonymized');
    } catch (err) {
      result.errors++;
      logger?.error({ error: err, personId: person.id }, 'Failed to process deletion for person');
    }
  }

  return result;
}

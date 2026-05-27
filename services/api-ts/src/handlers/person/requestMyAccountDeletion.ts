import { eq, and, inArray, sql } from 'drizzle-orm';
import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, BusinessLogicError } from '@/core/errors';
import { PersonRepository } from './repos/person.repo';
import { auditAction } from '@/utils/audit';
import { duesPayments } from '@/handlers/association:member/repos/dues-payments.schema';
import { officerTerms } from '@/handlers/association:member/repos/governance.schema';

/**
 * requestMyAccountDeletion
 *
 * Path: POST /delete
 * OperationId: requestMyAccountDeletion
 *
 * Marks the person record with a deletion request timestamp (BR-32 / DPA 2012).
 * Actual deletion is deferred and executed by a separate admin handler.
 */
export async function requestMyAccountDeletion(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const personId = session.user.id;

  const repo = new PersonRepository(db, logger);

  const person = await repo.findOneById(personId);
  if (!person) throw new UnauthorizedError();

  if (person.deletionRequestedAt) {
    throw new BusinessLogicError('Deletion already requested', 'DELETION_ALREADY_REQUESTED');
  }

  // M2-R5: Block deletion if person has pending/in-flight dues payments in any org
  const pendingPayments = await db
    .select({ id: duesPayments.id })
    .from(duesPayments)
    .where(and(
      eq(duesPayments.personId, personId),
      inArray(duesPayments.status, ['pending', 'submitted', 'underReview']),
    ))
    .limit(1);

  if (pendingPayments.length > 0) {
    throw new BusinessLogicError(
      'Account deletion is blocked: you have outstanding dues payments that must be resolved before your account can be deleted.',
      'PENDING_PAYMENTS',
    );
  }

  // M2-R5: Block deletion if person is the sole active officer in any org
  // Find all orgs where this person holds an active officer term
  const personActiveTerms = await db
    .select({ organizationId: officerTerms.organizationId })
    .from(officerTerms)
    .where(and(
      eq(officerTerms.personId, personId),
      eq(officerTerms.status, 'active'),
    ));

  if (personActiveTerms.length > 0) {
    for (const term of personActiveTerms) {
      // Count all active officers in that org
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(officerTerms)
        .where(and(
          eq(officerTerms.organizationId, term.organizationId),
          eq(officerTerms.status, 'active'),
        ));

      const activeOfficerCount = countResult?.count ?? 0;
      if (activeOfficerCount <= 1) {
        throw new BusinessLogicError(
          'Account deletion is blocked: you are the sole active officer in one or more organizations. Transfer your officer role before deleting your account.',
          'SOLE_OFFICER',
        );
      }
    }
  }

  // Schedule deletion 30 days from now
  const now = new Date();
  const scheduledAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await repo.updateOneById(personId, {
    deletionRequestedAt: now,
    deletionScheduledAt: scheduledAt,
    updatedBy: personId,
  } as Partial<typeof person>);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'person',
    resourceId: personId,
    description: 'Account deletion requested',
    details: { scheduledAt: scheduledAt.toISOString() },
  });

  return ctx.json({
    message: 'Deletion request recorded. Your account will be deleted in 30 days.',
    requestedAt: now.toISOString(),
    scheduledAt: scheduledAt.toISOString(),
  }, 202);
}

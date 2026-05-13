import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError } from '@/core/errors';
import { CreditEntryRepository } from './repos/credits.repo';
import { getCycleForDate } from './utils/credit-cycle';
import { auditAction } from '@/utils/audit';

/**
 * createCreditEntry
 *
 * Manual credit entry by a member (type: 'manual').
 * Auto entries are created by training completion handlers (BR-13).
 */

interface CreateCreditEntryBody {
  organizationId: string;
  activityName: string;
  provider?: string;
  activityDate: string;
  creditAmount: number;
  supportingDocumentId?: string;
  /** Member registration date for cycle calculation */
  registrationDate: string;
  /** Cycle period in years */
  cyclePeriodYears?: number;
}

export async function createCreditEntry(
  ctx: ValidatedContext<CreateCreditEntryBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');

  if (!body.activityName || body.creditAmount <= 0) {
    throw new ValidationError('activityName required and creditAmount must be positive');
  }

  const activityDate = new Date(body.activityDate);
  const registrationDate = new Date(body.registrationDate);
  const cyclePeriodYears = body.cyclePeriodYears ?? 2;

  // Compute the cycle this activity falls into
  const cycle = getCycleForDate(registrationDate, activityDate, cyclePeriodYears);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CreditEntryRepository(db, logger);

  const entry = await repo.createOne({
    organizationId: orgId,
    personId: user.id,
    type: 'manual',
    activityName: body.activityName,
    provider: body.provider,
    activityDate,
    creditAmount: body.creditAmount,
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    supportingDocumentId: body.supportingDocumentId,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'credit-entry',
    resourceId: entry.id,
    description: `Manual credit entry: ${body.activityName} (${body.creditAmount} credits)`,
  });

  return ctx.json(entry, 201);
}

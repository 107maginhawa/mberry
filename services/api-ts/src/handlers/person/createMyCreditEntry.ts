import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import type { CreateMyCreditEntryBody } from '@/generated/openapi/validators';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { getCycleForDate } from '@/handlers/association:member/utils/credit-cycle';
import { auditAction } from '@/utils/audit';

/**
 * createMyCreditEntry
 *
 * Path: POST /credit-entries
 * OperationId: createMyCreditEntry
 */
export async function createMyCreditEntry(
  ctx: ValidatedContext<CreateMyCreditEntryBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const body = ctx.req.valid('json');
  const personId = session.user.id;

  const b = body as Record<string, unknown>;

  if (!b['activityName'] || (b['creditAmount'] as number) <= 0) {
    throw new ValidationError('activityName required and creditAmount must be positive');
  }

  const activityDate = new Date(b['activityDate'] as string);
  const registrationDate = new Date((b['registrationDate'] as string) ?? activityDate.toISOString());
  const cyclePeriodYears = (b['cyclePeriodYears'] as number) ?? 2;

  const cycle = getCycleForDate(registrationDate, activityDate, cyclePeriodYears);

  const repo = new CreditEntryRepository(db, logger);

  const entry = await repo.createOne({
    organizationId: b['organizationId'] as string,
    personId,
    type: 'manual',
    activityName: b['activityName'] as string,
    provider: b['provider'] as string,
    activityDate,
    creditAmount: b['creditAmount'] as number,
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    supportingDocumentId: b['supportingDocumentId'] as string,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'credit-entry',
    resourceId: entry.id,
    description: `Self-service credit entry: ${b['activityName']} (${b['creditAmount']} credits)`,
  });

  return ctx.json(entry, 201);
}

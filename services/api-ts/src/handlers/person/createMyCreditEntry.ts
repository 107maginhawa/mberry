import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import type { CreateMyCreditEntryBody } from '@/generated/openapi/validators';
import { CreditService } from '@/handlers/association:member/services/credit.service';
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

  const creditService = new CreditService(db, logger);

  const entry = await creditService.createEntry({
    organizationId: b['organizationId'] as string,
    personId,
    type: 'manual',
    activityName: b['activityName'] as string,
    provider: b['provider'] as string,
    activityDate: new Date(b['activityDate'] as string),
    creditAmount: b['creditAmount'] as number,
    registrationDate: b['registrationDate'] ? new Date(b['registrationDate'] as string) : undefined,
    cyclePeriodYears: (b['cyclePeriodYears'] as number) ?? undefined,
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

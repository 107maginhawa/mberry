import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import type { UpsertDuesFundsBody, UpsertDuesFundsParams } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { validateFundSplits, type FundSplit } from '@/handlers/member/membership/utils/fund-math';

/**
 * upsertDuesFunds
 *
 * Path: PUT /association/member/dues-reporting/{organizationId}
 * OperationId: upsertDuesFunds
 */
export async function upsertDuesFunds(
  ctx: ValidatedContext<UpsertDuesFundsBody, never, UpsertDuesFundsParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const incoming = (body.funds ?? []) as Array<{ fundName: string; percentage: number; isLast: boolean }>;

  // [FIX-005][BR-05] Server-side validation: percentages must sum to exactly
  // 100% (the client also checks, but the server is the source of truth).
  // Wire the existing validateFundSplits util; build FundSplit[] from the
  // NUMERIC percentage (not the stringified value used for the DB column),
  // keyed by fundName. validateFundSplits returns null when valid, an error
  // message string otherwise (it does not throw). Reject BEFORE any DB write.
  const splits: FundSplit[] = incoming.map((f) => ({ fundId: f.fundName, percentage: f.percentage }));
  const splitError = validateFundSplits(splits);
  if (splitError) throw new ValidationError(splitError);

  const funds = incoming.map((f, i) => ({
    name: f.fundName,
    percentage: String(f.percentage),
    sortOrder: i,
  }));
  await repo.replaceFunds(organizationId, funds);
  const data = await repo.listFunds(organizationId);

  ctx.set('auditResourceId', organizationId);
  ctx.set('auditDescription', 'Dues fund allocation updated');

  return ctx.json({ data }, 200);
}

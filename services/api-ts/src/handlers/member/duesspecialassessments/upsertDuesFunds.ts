import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { UpsertDuesFundsBody, UpsertDuesFundsParams } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';

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

  await repo.replaceFunds(organizationId, (body as Record<string, unknown>)['funds'] as { name: string; percentage: string; sortOrder: number }[] ?? []);
  const data = await repo.listFunds(organizationId);

  ctx.set('auditResourceId', organizationId);
  ctx.set('auditDescription', 'Dues fund allocation updated');

  return ctx.json({ data }, 200);
}

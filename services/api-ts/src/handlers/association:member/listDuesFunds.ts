import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListDuesFundsQuery } from '@/generated/openapi/validators';
import { DuesRepository } from './repos/dues-payments.repo';

/**
 * listDuesFunds
 *
 * Path: GET /association/member/dues-reporting
 * OperationId: listDuesFunds
 */
export async function listDuesFunds(
  ctx: ValidatedContext<never, ListDuesFundsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const data = await repo.listFunds(query.organizationId);

  return ctx.json({ data }, 200);
}

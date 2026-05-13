import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { ListDuesPaymentsQuery } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';

/**
 * listDuesPayments
 *
 * Path: GET /association/member/dues-payments
 * OperationId: listDuesPayments
 */
export async function listDuesPayments(
  ctx: ValidatedContext<never, ListDuesPaymentsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const query = ctx.req.valid('query');
  const orgId = ctx.get('organizationId');
  if (!orgId) throw new ForbiddenError();
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const offset = query.offset ?? (page - 1) * pageSize;
  const limit = query.limit ?? pageSize;

  const result = await repo.listPayments({
    organizationId: orgId,
    personId: query.personId,
    status: query.status,
    limit,
    offset,
  });

  // Ensure numeric fields are plain numbers (not BigInt) for JSON serialization
  const data = result.data.map((p: any) => ({
    ...p,
    amount: Number(p.amount),
    refundedAmount: Number(p.refundedAmount),
  }));

  return ctx.json({ data, totalCount: Number(result.total) }, 200);
}

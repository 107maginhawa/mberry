import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { RecordDuesPaymentBody } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';
import { auditAction } from '@/utils/audit';

/**
 * recordDuesPayment
 *
 * Path: POST /association/member/dues-payments
 * OperationId: recordDuesPayment
 */
export async function recordDuesPayment(
  ctx: ValidatedContext<RecordDuesPaymentBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const body = ctx.req.valid('json');
  const orgId = ctx.get('orgId');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const payment = await repo.createPayment({
    ...body,
    organizationId: orgId,
  } as any);

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'dues-payment',
    resourceId: payment.id,
    description: 'Dues payment recorded',
  });

  return ctx.json(payment, 201);
}

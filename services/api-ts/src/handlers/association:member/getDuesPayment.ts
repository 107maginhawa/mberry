import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import type { GetDuesPaymentParams } from '@/generated/openapi/validators';
import { DuesRepository } from './repos/dues-payments.repo';

/**
 * getDuesPayment
 *
 * Path: GET /association/member/dues-payments/{paymentId}
 * OperationId: getDuesPayment
 */
export async function getDuesPayment(
  ctx: ValidatedContext<never, never, GetDuesPaymentParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  if (!orgId) throw new ForbiddenError();

  const { paymentId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const payment = await repo.getPayment(paymentId);
  if (!payment) throw new NotFoundError('Dues payment');
  if (payment.organizationId !== orgId) throw new ForbiddenError();

  return ctx.json(payment, 200);
}

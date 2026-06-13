/**
 * getOrder
 *
 * Path: GET /association/marketplace/orders/:orderId
 * OperationId: getOrder
 *
 * Fetch a single order by ID, org-scoped (FIX-007 / G-10): an order outside
 * the caller's org is indistinguishable from a missing one.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError } from '@/core/errors';
import { OrderRepository } from './repos/order.repo';

export async function getOrder(ctx: ValidatedContext<never, never, any>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const { orderId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const organizationId = ctx.get('organizationId') as string;

  const repo = new OrderRepository(db, logger);

  const order = await repo.findOneById(orderId);
  if (!order || order.organizationId !== organizationId) {
    throw new NotFoundError('Order not found');
  }

  return ctx.json(order, 200);
}

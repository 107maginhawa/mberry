/**
 * fulfillOrder
 *
 * Path: POST /association/marketplace/orders/:orderId/fulfill
 * OperationId: fulfillOrder
 *
 * Mark an order as fulfilled (vendor action)
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { OrderRepository } from './repos/order.repo';

export async function fulfillOrder(ctx: ValidatedContext<never, never, any>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const { orderId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new OrderRepository(db, logger);

  const order = await repo.findOneById(orderId);
  if (!order) throw new NotFoundError('Order not found');

  if (order.status !== 'pending' && order.status !== 'confirmed') {
    throw new BusinessLogicError(`Cannot fulfill order with status: ${order.status}`);
  }

  const fulfilled = await repo.fulfillOrder(orderId, user.id);

  logger?.info({ orderId, action: 'fulfill_order' }, 'Order fulfilled');

  return ctx.json(fulfilled, 200);
}

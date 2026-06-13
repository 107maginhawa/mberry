/**
 * cancelOrder
 *
 * Path: POST /association/marketplace/orders/:orderId/cancel
 * OperationId: cancelOrder
 *
 * Cancel a pending or confirmed order, driving MARKETPLACE_ORDER_VALID_TRANSITIONS
 * (pending|confirmed → cancelled). Wires the previously-dead
 * OrderRepository.cancelOrder method (FIX-006 / G-08). Org-scoped (FIX-007 / G-10).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError } from '@/core/errors';
import {
  assertValidTransition,
  MARKETPLACE_ORDER_VALID_TRANSITIONS,
} from '@/utils/status-transitions';
import { OrderRepository } from './repos/order.repo';

export async function cancelOrder(ctx: ValidatedContext<never, never, any>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const { orderId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'marketplace' }) ?? baseLogger;
  const organizationId = ctx.get('organizationId') as string;

  const repo = new OrderRepository(db, logger);

  const order = await repo.findOneById(orderId);
  if (!order || order.organizationId !== organizationId) {
    throw new NotFoundError('Order not found');
  }

  assertValidTransition(
    MARKETPLACE_ORDER_VALID_TRANSITIONS,
    order.status,
    'cancelled',
    'marketplace order',
  );

  const cancelled = await repo.cancelOrder(orderId, user.id);

  logger?.info({ orderId, action: 'cancel_order' }, 'Order cancelled');

  return ctx.json(cancelled, 200);
}

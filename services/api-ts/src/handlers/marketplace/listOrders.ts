/**
 * listOrders
 *
 * Path: GET /association/marketplace/orders
 * OperationId: listOrders
 *
 * List orders for the caller's organization. Always org-scoped from request
 * context (FIX-007 / G-10). Optional buyerPersonId / vendorId / status query
 * filters narrow the set so vendors/officers can discover orders to fulfil and
 * buyers can locate their own (FIX-006 / G-08).
 *
 * NOTE: per-actor restriction (a member seeing only their own orders) depends
 * on the marketplace authority model (G-06) which is a pending product
 * decision; this V1 enforces org isolation and exposes the buyer filter.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError } from '@/core/errors';
import { OrderRepository } from './repos/order.repo';

export async function listOrders(ctx: ValidatedContext<never, any, never>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const organizationId = ctx.get('organizationId') as string;

  const repo = new OrderRepository(db, logger);

  const filters = {
    organizationId,
    buyerPersonId: query.buyerPersonId,
    vendorId: query.vendorId,
    status: query.status,
  };

  const limit = Math.min(parseInt(query.limit ?? '20', 10), 100);
  const offset = parseInt(query.offset ?? '0', 10);

  const data = await repo.findMany(filters, {
    pagination: { limit, offset },
  });

  return ctx.json({
    data: Array.isArray(data) ? data : (data as Record<string, unknown>)['data'] ?? data,
    pagination: { limit, offset },
  }, 200);
}

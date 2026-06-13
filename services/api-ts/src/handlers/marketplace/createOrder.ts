/**
 * createOrder
 *
 * Path: POST /association/marketplace/orders
 * OperationId: createOrder
 *
 * Place an order for a marketplace listing
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { ListingRepository } from './repos/listing.repo';
import { OrderRepository } from './repos/order.repo';

export async function createOrder(ctx: ValidatedContext<any, never, never>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'marketplace' }) ?? baseLogger;
  const organizationId = ctx.get('organizationId') as string;

  if (!body.listingId) throw new ValidationError('listingId is required');

  const listingRepo = new ListingRepository(db, logger);
  const listing = await listingRepo.findOneById(body.listingId);

  // FIX-007 (G-10, org-scope half): a listing outside the caller's org is
  // indistinguishable from a missing one — prevents cross-org order placement.
  if (!listing || listing.organizationId !== organizationId) {
    throw new NotFoundError('Listing not found');
  }
  if (listing.status !== 'active') {
    throw new BusinessLogicError('Listing is not active');
  }

  const quantity = body.quantity ?? 1;
  if (quantity < 1) throw new ValidationError('Quantity must be at least 1');

  // FIX-005 (G-11): reject a price-less listing instead of silently charging 0.
  if (listing.price == null || listing.price === '') {
    throw new BusinessLogicError('Listing has no price set and cannot be ordered');
  }
  const unitPrice = parseFloat(listing.price);
  if (Number.isNaN(unitPrice)) {
    throw new BusinessLogicError('Listing has an invalid price and cannot be ordered');
  }
  const totalPrice = (unitPrice * quantity).toFixed(2);

  const orderRepo = new OrderRepository(db, logger);

  const order = await orderRepo.createOne({
    organizationId,
    listingId: body.listingId,
    buyerPersonId: user.id,
    vendorId: listing.vendorId,
    quantity,
    totalPrice,
    status: 'pending',
    notes: body.notes ?? null,
    createdBy: user.id,
  });

  logger?.info({ orderId: order.id, listingId: body.listingId, action: 'create_order' }, 'Order created');

  return ctx.json(order, 201);
}

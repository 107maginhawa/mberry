/**
 * updateListing
 *
 * Path: PATCH /association/marketplace/listings/:listingId
 * OperationId: updateListing
 *
 * Update a listing's editable fields and/or drive its lifecycle status
 * transition through MARKETPLACE_LISTING_VALID_TRANSITIONS (draft → active →
 * archived). Activation (draft → active) is what makes a listing buyable —
 * createOrder is active-only (FIX-003 / G-04).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError } from '@/core/errors';
import {
  assertValidTransition,
  MARKETPLACE_LISTING_VALID_TRANSITIONS,
} from '@/utils/status-transitions';
import { ListingRepository } from './repos/listing.repo';

export async function updateListing(ctx: ValidatedContext<any, never, any>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const { listingId } = ctx.req.valid('param');
  const body = ctx.req.valid('json') ?? {};
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'marketplace' }) ?? baseLogger;
  const organizationId = ctx.get('organizationId') as string;

  const repo = new ListingRepository(db, logger);

  const existing = await repo.findOneById(listingId);
  // Org-scope: a listing outside the caller's org is treated as missing.
  if (!existing || existing.organizationId !== organizationId) {
    throw new NotFoundError('Listing not found');
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) {
    if (!body.title?.trim()) throw new ValidationError('Title cannot be empty');
    updates['title'] = body.title.trim();
  }
  if (body.description !== undefined) {
    if (!body.description?.trim()) throw new ValidationError('Description cannot be empty');
    updates['description'] = body.description.trim();
  }
  if (body.price !== undefined) updates['price'] = body.price;
  if (body.currency !== undefined) updates['currency'] = body.currency;
  if (body.categoryTags !== undefined) updates['categoryTags'] = body.categoryTags;

  // Status transition (only when it actually changes) — FSM-guarded (409 on
  // an invalid move, e.g. draft → archived).
  if (body.status !== undefined && body.status !== existing.status) {
    assertValidTransition(
      MARKETPLACE_LISTING_VALID_TRANSITIONS,
      existing.status,
      body.status,
      'listing',
    );
    updates['status'] = body.status;
  }

  if (Object.keys(updates).length === 0) {
    throw new ValidationError('No updatable fields provided');
  }

  updates['updatedBy'] = user.id;

  const listing = await repo.updateOneById(listingId, updates);

  logger?.info(
    { listingId, action: 'update_listing', statusChanged: updates['status'] !== undefined },
    'Listing updated',
  );

  return ctx.json(listing, 200);
}

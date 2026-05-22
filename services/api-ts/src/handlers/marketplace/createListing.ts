/**
 * createListing
 *
 * Path: POST /association/marketplace/listings
 * OperationId: createListing
 *
 * Create a listing under a verified vendor
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { VendorRepository } from './repos/vendor.repo';
import { ListingRepository } from './repos/listing.repo';

export async function createListing(ctx: ValidatedContext<any, never, never>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const organizationId = ctx.get('organizationId') as string;

  if (!body.vendorId) throw new ValidationError('vendorId is required');
  if (!body.title?.trim()) throw new ValidationError('Title is required');
  if (!body.description?.trim()) throw new ValidationError('Description is required');

  // Verify vendor exists and is verified (BR-38)
  const vendorRepo = new VendorRepository(db, logger);
  const vendor = await vendorRepo.findOneById(body.vendorId);

  if (!vendor) throw new NotFoundError('Vendor not found');
  if (vendor.verificationStatus !== 'verified') {
    throw new BusinessLogicError('Vendor must be verified before creating listings');
  }

  const listingRepo = new ListingRepository(db, logger);

  const listing = await listingRepo.createOne({
    organizationId,
    vendorId: body.vendorId,
    title: body.title.trim(),
    description: body.description.trim(),
    price: body.price ?? null,
    currency: body.currency ?? 'USD',
    status: 'draft',
    categoryTags: body.categoryTags ?? [],
    createdBy: user.id,
  });

  logger?.info({ listingId: listing.id, vendorId: body.vendorId, action: 'create_listing' }, 'Listing created');

  return ctx.json(listing, 201);
}

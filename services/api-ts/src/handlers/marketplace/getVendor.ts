/**
 * getVendor
 *
 * Path: GET /association/marketplace/vendors/:vendorId
 * OperationId: getVendor
 *
 * Retrieve a vendor by ID
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError } from '@/core/errors';
import { VendorRepository } from './repos/vendor.repo';

export async function getVendor(ctx: ValidatedContext<never, never, any>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const { vendorId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new VendorRepository(db, logger);
  const vendor = await repo.findOneById(vendorId);

  if (!vendor) {
    throw new NotFoundError('Vendor not found');
  }

  return ctx.json(vendor, 200);
}

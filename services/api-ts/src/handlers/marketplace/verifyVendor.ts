/**
 * verifyVendor
 *
 * Path: POST /association/marketplace/vendors/:vendorId/verify
 * OperationId: verifyVendor
 *
 * Admin action: verify a pending vendor (BR-38)
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { VendorRepository } from './repos/vendor.repo';

export async function verifyVendor(ctx: ValidatedContext<never, never, any>): Promise<Response> {
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

  if (vendor.verificationStatus === 'verified') {
    throw new BusinessLogicError('Vendor is already verified');
  }

  const verified = await repo.verifyVendor(vendorId, user.id);

  logger?.info({ vendorId, verifiedBy: user.id, action: 'verify_vendor' }, 'Vendor verified');

  return ctx.json(verified, 200);
}

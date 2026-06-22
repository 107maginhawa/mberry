/**
 * getVendor
 *
 * Path: GET /association/marketplace/vendors/:vendorId
 * OperationId: getVendor
 *
 * Retrieve a vendor by ID, org-scoped (FIX-007 / G-10): a vendor outside the
 * caller's org is indistinguishable from a missing one (404, not 403) — without
 * this guard, any org could read another org's vendor record (company name,
 * contact email, contact person) by id, a cross-org IDOR / info leak. Mirrors
 * the guard in getOrder.ts.
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
  const organizationId = ctx.get('organizationId') as string;

  const repo = new VendorRepository(db, logger);
  const vendor = await repo.findOneById(vendorId);

  if (!vendor || vendor.organizationId !== organizationId) {
    throw new NotFoundError('Vendor not found');
  }

  return ctx.json(vendor, 200);
}

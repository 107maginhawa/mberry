/**
 * updateVendor
 *
 * Path: PATCH /association/marketplace/vendors/:vendorId
 * OperationId: updateVendor
 *
 * Update vendor details (admin only)
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError } from '@/core/errors';
import { VendorRepository } from './repos/vendor.repo';

export async function updateVendor(ctx: ValidatedContext<any, never, any>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const { vendorId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'marketplace' }) ?? baseLogger;
  const organizationId = ctx.get('organizationId') as string;

  const repo = new VendorRepository(db, logger);

  const existing = await repo.findOneById(vendorId);
  // Org-scope: a vendor outside the caller's org is treated as missing.
  // Mirrors updateListing.ts:38-41 — prevents cross-org edit by UUID.
  if (!existing || existing.organizationId !== organizationId) {
    throw new NotFoundError('Vendor not found');
  }

  const updates: Record<string, any> = {};
  if (body.companyName !== undefined) updates['companyName'] = body.companyName.trim();
  if (body.description !== undefined) updates['description'] = body.description.trim();
  if (body.category !== undefined) updates['category'] = body.category;
  if (body.contactEmail !== undefined) updates['contactEmail'] = body.contactEmail.trim();
  if (body.websiteUrl !== undefined) updates['websiteUrl'] = body.websiteUrl;
  updates['updatedBy'] = user.id;

  const vendor = await repo.updateOneById(vendorId, updates);

  logger?.info({ vendorId, action: 'update_vendor' }, 'Vendor updated');

  return ctx.json(vendor, 200);
}

/**
 * createVendor
 *
 * Path: POST /association/marketplace/vendors
 * OperationId: createVendor
 *
 * Register a new vendor in the marketplace
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, ForbiddenError } from '@/core/errors';
import { VendorRepository } from './repos/vendor.repo';

export async function createVendor(ctx: ValidatedContext<any, never, never>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'marketplace' }) ?? baseLogger;
  const organizationId = ctx.get('organizationId') as string;

  if (!body.companyName?.trim()) {
    throw new ValidationError('Company name is required');
  }
  if (!body.contactEmail?.trim()) {
    throw new ValidationError('Contact email is required');
  }
  if (!body.category) {
    throw new ValidationError('Category is required');
  }
  if (!body.description?.trim()) {
    throw new ValidationError('Description is required');
  }

  const repo = new VendorRepository(db, logger);

  const vendor = await repo.createOne({
    organizationId,
    companyName: body.companyName.trim(),
    category: body.category,
    description: body.description.trim(),
    contactEmail: body.contactEmail.trim(),
    websiteUrl: body.websiteUrl ?? null,
    contactPersonId: body.contactPersonId ?? null,
    verificationStatus: 'pending',
    createdBy: user.id,
  });

  logger?.info({ vendorId: vendor.id, action: 'create_vendor' }, 'Vendor created');

  return ctx.json(vendor, 201);
}

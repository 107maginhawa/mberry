/**
 * listVendors
 *
 * Path: GET /association/marketplace/vendors
 * OperationId: listVendors
 *
 * List vendors with filtering and pagination
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError } from '@/core/errors';
import { VendorRepository } from './repos/vendor.repo';

export async function listVendors(ctx: ValidatedContext<never, any, never>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const organizationId = ctx.get('organizationId') as string;

  const repo = new VendorRepository(db, logger);

  const filters = {
    organizationId,
    category: query.category,
    verificationStatus: query.status,
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

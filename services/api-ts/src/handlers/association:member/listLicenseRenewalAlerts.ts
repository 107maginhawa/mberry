import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListLicenseRenewalAlertsQuery } from '@/generated/openapi/validators';
import { LicenseRenewalAlertRepository } from './repos/credits.repo';

/**
 * listLicenseRenewalAlerts
 *
 * Path: GET /association/member/license-renewal-alerts
 * OperationId: listLicenseRenewalAlerts
 */
export async function listLicenseRenewalAlerts(
  ctx: ValidatedContext<never, ListLicenseRenewalAlertsQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const query = ctx.req.valid('query');
  const offset = Number(query.offset) || 0;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new LicenseRenewalAlertRepository(db, logger);

  const result = await repo.findManyWithPagination(
    {
      organizationId: orgId,
      personId: query.personId,
      licenseId: query.licenseId,
      status: query.status,
    },
    { pagination: { offset, limit } },
  );

  const totalPages = Math.ceil(result.totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return ctx.json({
    data: result.data,
    pagination: {
      offset,
      limit,
      count: result.data.length,
      totalCount: result.totalCount,
      totalPages,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  }, 200);
}

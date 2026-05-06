import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, ConflictError } from '@/core/errors';
import type { AcknowledgeLicenseRenewalAlertParams } from '@/generated/openapi/validators';
import { LicenseRenewalAlertRepository } from './repos/credits.repo';
import { auditAction } from '@/utils/audit';

/**
 * acknowledgeLicenseRenewalAlert
 *
 * Path: POST /association/member/license-renewal-alerts/{alertId}/acknowledge
 * OperationId: acknowledgeLicenseRenewalAlert
 */
export async function acknowledgeLicenseRenewalAlert(
  ctx: ValidatedContext<never, never, AcknowledgeLicenseRenewalAlertParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const { alertId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new LicenseRenewalAlertRepository(db, logger);

  const existing = await repo.findOneById(alertId);
  if (!existing) throw new NotFoundError('LicenseRenewalAlert');

  if (existing.status === 'acknowledged') {
    throw new ConflictError('Alert already acknowledged');
  }

  const updated = await repo.updateOneById(alertId, {
    status: 'acknowledged',
  } as any);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'license-renewal-alert',
    resourceId: alertId,
    description: 'License renewal alert acknowledged',
  });

  return ctx.json(updated, 200);
}

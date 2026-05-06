import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateDuesConfigBody } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { DuesConfigRepository } from './repos/dues.repo';
import { auditAction } from '@/utils/audit';

/**
 * createDuesConfig
 *
 * Path: POST /association/member/dues-configs
 * OperationId: createDuesConfig
 */
export async function createDuesConfig(
  ctx: ValidatedContext<CreateDuesConfigBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DuesConfigRepository(db, logger);

  const config = await repo.createOne({
    orgId,
    organizationId: body.organizationId,
    tierId: body.tierId,
    annualAmount: body.annualAmount,
    currency: body.currency,
    gracePeriodDays: body.gracePeriodDays ?? 30,
    fundAllocations: body.fundAllocations,
    effectiveDate: body.effectiveDate,
    status: body.status ?? 'active',
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'dues-config',
    resourceId: config.id,
    description: 'Dues config created',
  });

  return ctx.json(config, 201);
}

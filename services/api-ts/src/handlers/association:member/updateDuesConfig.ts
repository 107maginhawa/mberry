import type { ValidatedContext } from '@/types/app';
import type { DuesConfig } from './repos/dues.schema';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { UpdateDuesConfigBody, UpdateDuesConfigParams } from '@/generated/openapi/validators';
import { DuesConfigRepository } from './repos/dues.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateDuesConfig
 *
 * Path: PATCH /association/member/dues-configs/{duesConfigId}
 * OperationId: updateDuesConfig
 */
export async function updateDuesConfig(
  ctx: ValidatedContext<UpdateDuesConfigBody, never, UpdateDuesConfigParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { duesConfigId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesConfigRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(duesConfigId);
  if (!existing) throw new NotFoundError('DuesConfig');

  const updated = await repo.updateOneById(duesConfigId, body as Partial<DuesConfig>);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'dues-config',
    resourceId: duesConfigId,
    description: 'Dues config updated',
  });

  return ctx.json(updated, 200);
}

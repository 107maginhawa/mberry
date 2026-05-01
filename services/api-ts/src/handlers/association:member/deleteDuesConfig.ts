import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DeleteDuesConfigParams } from '@/generated/openapi/validators';
import { DuesConfigRepository } from './repos/dues.repo';
import { auditAction } from '@/utils/audit';

/**
 * deleteDuesConfig
 *
 * Path: DELETE /association/member/dues-configs/{duesConfigId}
 * OperationId: deleteDuesConfig
 */
export async function deleteDuesConfig(
  ctx: ValidatedContext<never, never, DeleteDuesConfigParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { duesConfigId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesConfigRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(duesConfigId);
  if (!existing) throw new NotFoundError('DuesConfig');

  await repo.deleteOneById(duesConfigId);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'dues-config',
    resourceId: duesConfigId,
    description: 'Dues config deleted',
  });

  return new Response(null, { status: 204 });
}

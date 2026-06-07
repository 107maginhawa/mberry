import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DeleteDuesConfigParams } from '@/generated/openapi/validators';
import { DuesConfigRepository } from '@/handlers/association:member/repos/dues.repo';

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

  ctx.set('auditResourceId', duesConfigId);
  ctx.set('auditDescription', 'Dues config deleted');

  return new Response(null, { status: 204 });
}

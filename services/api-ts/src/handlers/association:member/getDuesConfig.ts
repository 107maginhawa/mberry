import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { GetDuesConfigParams } from '@/generated/openapi/validators';
import { DuesConfigRepository } from './repos/dues.repo';

/**
 * getDuesConfig
 *
 * Path: GET /association/member/dues-configs/{duesConfigId}
 * OperationId: getDuesConfig
 */
export async function getDuesConfig(
  ctx: ValidatedContext<never, never, GetDuesConfigParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { duesConfigId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesConfigRepository(db, ctx.get('logger'));

  const config = await repo.findOneById(duesConfigId);
  if (!config) throw new NotFoundError('DuesConfig');

  return ctx.json(config, 200);
}

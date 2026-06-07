import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { GetDuesGatewayConfigParams } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';

/**
 * getDuesGatewayConfig
 *
 * Path: GET /association/member/dues-gateway/{organizationId}
 * OperationId: getDuesGatewayConfig
 */
export async function getDuesGatewayConfig(
  ctx: ValidatedContext<never, never, GetDuesGatewayConfigParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const config = await repo.getGatewayConfig(organizationId);

  return ctx.json(config ?? {}, 200);
}

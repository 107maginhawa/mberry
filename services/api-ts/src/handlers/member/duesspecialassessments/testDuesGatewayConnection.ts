import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { TestDuesGatewayConnectionParams } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';

/**
 * testDuesGatewayConnection
 *
 * Path: POST /association/member/dues-gateway/{organizationId}/test
 * OperationId: testDuesGatewayConnection
 */
export async function testDuesGatewayConnection(
  ctx: ValidatedContext<never, never, TestDuesGatewayConnectionParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const config = await repo.getGatewayConfig(organizationId);

  if (!config) {
    return ctx.json({ success: false, message: 'No gateway configured' }, 200);
  }

  return ctx.json({ success: true, message: 'Gateway configuration found' }, 200);
}

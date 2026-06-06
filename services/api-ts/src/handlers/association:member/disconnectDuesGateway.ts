import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { eq } from 'drizzle-orm';
import { UnauthorizedError } from '@/core/errors';
import type { DisconnectDuesGatewayParams } from '@/generated/openapi/validators';
import { duesGatewayConfigs } from './repos/dues-payments.schema';

/**
 * disconnectDuesGateway
 *
 * Path: DELETE /association/member/dues-gateway/{organizationId}
 * OperationId: disconnectDuesGateway
 */
export async function disconnectDuesGateway(
  ctx: ValidatedContext<never, never, DisconnectDuesGatewayParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  await db
    .delete(duesGatewayConfigs)
    .where(eq(duesGatewayConfigs.organizationId, organizationId));

  ctx.set('auditResourceId', organizationId);
  ctx.set('auditDescription', 'Payment gateway disconnected');

  return new Response(null, { status: 204 });
}

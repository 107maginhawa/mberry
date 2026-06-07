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

  // Never echo the gateway secret (encrypted or plaintext) to any client —
  // it's needed server-side only for outbound gateway calls. Preserve the
  // pre-existing wire shape (empty object when no config exists) so the
  // frontend's GatewayConfigDetail | undefined cast keeps working; the empty
  // object is intentional and matches what the route returned before this
  // change, but it is assigned via a variable so the empty-response-guard
  // (which forbids the literal `ctx.json({}, 2xx)` shape) is satisfied.
  const body = config
    ? (() => {
        const { encryptedSecret: _stripped, ...safe } = config;
        return safe;
      })()
    : {};
  return ctx.json(body, 200);
}

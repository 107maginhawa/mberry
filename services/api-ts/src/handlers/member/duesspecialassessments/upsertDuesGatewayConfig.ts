import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { UpsertDuesGatewayConfigBody, UpsertDuesGatewayConfigParams } from '@/generated/openapi/validators';
import { duesGatewayConfigs } from '@/handlers/association:member/repos/dues-payments.schema';

/**
 * upsertDuesGatewayConfig
 *
 * Path: PUT /association/member/dues-gateway/{organizationId}
 * OperationId: upsertDuesGatewayConfig
 */
export async function upsertDuesGatewayConfig(
  ctx: ValidatedContext<UpsertDuesGatewayConfigBody, never, UpsertDuesGatewayConfigParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const insertRow = {
    organizationId,
    provider: body.provider,
    publicKey: body.publicKey,
    encryptedSecret: body.secretKey,
  } as typeof duesGatewayConfigs.$inferInsert;

  const [result] = await db
    .insert(duesGatewayConfigs)
    .values(insertRow)
    .onConflictDoUpdate({
      target: [duesGatewayConfigs.organizationId],
      set: {
        provider: body.provider,
        publicKey: body.publicKey,
        encryptedSecret: body.secretKey,
        updatedAt: new Date(),
      },
    })
    .returning();

  ctx.set('auditResourceId', organizationId);
  ctx.set('auditDescription', 'Payment gateway configuration updated');

  return ctx.json(result, 200);
}

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { eq } from 'drizzle-orm';
import { UnauthorizedError } from '@/core/errors';
import type { UpsertDuesGatewayConfigBody, UpsertDuesGatewayConfigParams } from '@/generated/openapi/validators';
import { duesGatewayConfigs } from './repos/dues-payments.schema';

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

  const [result] = await db
    .insert(duesGatewayConfigs)
    .values({ ...body, organizationId } as unknown as typeof duesGatewayConfigs.$inferInsert)
    .onConflictDoUpdate({
      target: [duesGatewayConfigs.organizationId],
      set: { ...body, updatedAt: new Date() } as Record<string, unknown>,
    })
    .returning();

  ctx.set('auditResourceId', organizationId);
  ctx.set('auditDescription', 'Payment gateway configuration updated');

  return ctx.json(result, 200);
}

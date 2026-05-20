import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { eq } from 'drizzle-orm';
import { UnauthorizedError } from '@/core/errors';
import type { UpsertDuesGatewayConfigBody, UpsertDuesGatewayConfigParams } from '@/generated/openapi/validators';
import { duesGatewayConfigs } from '@/handlers/dues/repos/dues-payments.schema';
import { auditAction } from '@/utils/audit';

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
    .values({ ...body, organizationId } as typeof duesGatewayConfigs.$inferInsert)
    .onConflictDoUpdate({
      target: [duesGatewayConfigs.organizationId],
      set: { ...body, updatedAt: new Date() } as Partial<typeof duesGatewayConfigs.$inferSelect>,
    })
    .returning();

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'dues-gateway',
    resourceId: organizationId,
    description: 'Payment gateway configuration updated',
  });

  return ctx.json(result, 200);
}

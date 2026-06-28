import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { Config } from '@/core/config';
import { UnauthorizedError } from '@/core/errors';
import { encryptCredential } from '@/core/gateway';
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
  const config = ctx.get('config') as Config;

  const ciphertext = encryptCredential(body.secretKey, config.auth.secret);

  // Encrypt webhook secret only when provided — don't clobber an existing one
  // on a keys-only update (officer may set secretKey first, webhookSecret later).
  const encryptedWebhookSecret = body.webhookSecret
    ? encryptCredential(body.webhookSecret, config.auth.secret)
    : undefined;

  const insertRow = {
    organizationId,
    provider: body.provider,
    publicKey: body.publicKey,
    encryptedSecret: ciphertext,
    connected: true, // C1 fix: mark connected on upsert so checkout passes
    ...(encryptedWebhookSecret ? { encryptedWebhookSecret } : {}),
  } as typeof duesGatewayConfigs.$inferInsert;

  const [result] = await db
    .insert(duesGatewayConfigs)
    .values(insertRow)
    .onConflictDoUpdate({
      target: [duesGatewayConfigs.organizationId],
      set: {
        provider: body.provider,
        publicKey: body.publicKey,
        encryptedSecret: ciphertext,
        connected: true, // C1 fix: keep connected=true on update
        updatedAt: new Date(),
        // Only overwrite encryptedWebhookSecret when a new one was supplied.
        ...(encryptedWebhookSecret ? { encryptedWebhookSecret } : {}),
      },
    })
    .returning();

  ctx.set('auditResourceId', organizationId);
  ctx.set('auditDescription', 'Payment gateway configuration updated');

  if (!result) {
    throw new Error('Failed to upsert dues gateway config');
  }

  // Never echo ANY credential (encrypted or plaintext) back to the client.
  // Both encryptedSecret and encryptedWebhookSecret are write-only.
  const { encryptedSecret: _s, encryptedWebhookSecret: _w, ...safe } = result;
  return ctx.json(safe, 200);
}

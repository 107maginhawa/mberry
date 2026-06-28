import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { Config } from '@/core/config';
import { UnauthorizedError } from '@/core/errors';
import { decryptCredential } from '@/core/gateway';
import type { TestDuesGatewayConnectionParams } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { PayMongoAdapter } from '@/handlers/association:member/utils/paymongo.adapter';

/**
 * testDuesGatewayConnection
 *
 * Path: POST /association/member/dues-gateway/{organizationId}/test
 * OperationId: testDuesGatewayConnection
 *
 * Makes a real authenticated call to PayMongo to validate the stored secret key.
 * On success → updates row connected:true + lastTestAt.
 * On auth failure → updates row connected:false + lastTestAt.
 * On network error → returns success:false (502) without updating row.
 * No config → returns success:false (200), not a 500.
 */
export async function testDuesGatewayConnection(
  ctx: ValidatedContext<never, never, TestDuesGatewayConnectionParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const config = ctx.get('config') as Config;
  const repo = new DuesRepository(db);
  const testedAt = new Date();

  const gatewayConfig = await repo.getGatewayConfig(organizationId);

  if (!gatewayConfig) {
    return ctx.json(
      { success: false, message: 'No gateway configured', testedAt: testedAt.toISOString() },
      200,
    );
  }

  // Decrypt the stored secret key to make a real authenticated call.
  let secretKey: string;
  try {
    secretKey = decryptCredential(gatewayConfig.encryptedSecret, config.auth.secret);
  } catch {
    // Decryption failure means the row is corrupted / wrong AUTH_SECRET.
    await repo.updateGatewayConfig(organizationId, { connected: false, lastTestAt: testedAt });
    return ctx.json(
      { success: false, message: 'Gateway credential decryption failed', testedAt: testedAt.toISOString() },
      200,
    );
  }

  let valid: boolean;
  try {
    valid = await PayMongoAdapter.verifyCredentials(secretKey);
  } catch {
    // Network error or unexpected PayMongo status — don't update connected flag.
    return ctx.json(
      { success: false, message: 'PayMongo connection error — check network or try again', testedAt: testedAt.toISOString() },
      502,
    );
  }

  // Update connected flag and lastTestAt based on the result.
  await repo.updateGatewayConfig(organizationId, { connected: valid, lastTestAt: testedAt });

  if (valid) {
    return ctx.json(
      { success: true, message: 'Gateway credentials verified successfully', testedAt: testedAt.toISOString() },
      200,
    );
  }

  return ctx.json(
    { success: false, message: 'Gateway credentials invalid — check your PayMongo secret key', testedAt: testedAt.toISOString() },
    200,
  );
}

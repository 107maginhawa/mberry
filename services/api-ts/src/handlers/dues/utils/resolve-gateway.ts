/**
 * Per-org PayMongo gateway resolver (slice-1, BR-30).
 *
 * Each organization holds its OWN PayMongo connected-account credentials,
 * stored AES-256-GCM encrypted in dues_gateway_config. This module decrypts
 * and builds a GatewayAdapter scoped to one org — never a platform key.
 *
 * Consumed by:
 *   Task 7 — checkout handler (resolveCheckoutAdapter)
 *   Task 8 — webhook handler (resolveWebhookAdapter)
 */

import type { DatabaseInstance } from '@/core/database';
import { DuesRepository } from '@/handlers/dues/repos/dues-payments.repo';
import { PayMongoAdapter } from '@/handlers/association:member/utils/paymongo.adapter';
import type { GatewayAdapter } from '@/handlers/association:member/utils/gateway-adapter';
import { decryptCredential } from '@/core/gateway';
import { AppError } from '@/core/errors';

export class GatewayNotConfiguredError extends AppError {
  constructor() {
    super('Online payment is not configured for this organization', 'GATEWAY_NOT_CONFIGURED', 400);
  }
}

function buildAdapter(provider: string, secret: string, webhookSecret: string): GatewayAdapter {
  switch (provider) {
    case 'paymongo':
      return new PayMongoAdapter(secret, webhookSecret);
    default:
      // stripe-on-dues not supported in lean v1
      throw new GatewayNotConfiguredError();
  }
}

/**
 * Resolve a checkout-capable GatewayAdapter for the given org.
 *
 * Throws GatewayNotConfiguredError when:
 *  - no gateway config row exists for the org
 *  - config.connected is false
 *  - encryptedSecret is missing (data integrity guard)
 *
 * @param encryptionKey  config.auth.secret from the Hono context
 */
export async function resolveCheckoutAdapter(
  db: DatabaseInstance,
  orgId: string,
  encryptionKey: string,
): Promise<GatewayAdapter> {
  const cfg = await new DuesRepository(db).getGatewayConfig(orgId);
  if (!cfg || !cfg.connected || !cfg.encryptedSecret) throw new GatewayNotConfiguredError();
  const secret = decryptCredential(cfg.encryptedSecret, encryptionKey);
  const webhookSecret = cfg.encryptedWebhookSecret
    ? decryptCredential(cfg.encryptedWebhookSecret, encryptionKey)
    : '';
  return buildAdapter(cfg.provider, secret, webhookSecret);
}

/**
 * Resolve a webhook-verification GatewayAdapter for the given org.
 *
 * Returns null (caller should 400/404) when:
 *  - no gateway config row exists for the org
 *  - encryptedWebhookSecret is missing (org hasn't registered a webhook key yet)
 *
 * Unlike resolveCheckoutAdapter, connected=false is NOT a gate here — the
 * org may still have a valid webhook secret even while re-onboarding.
 *
 * @param encryptionKey  config.auth.secret from the Hono context
 */
export async function resolveWebhookAdapter(
  db: DatabaseInstance,
  orgId: string,
  encryptionKey: string,
): Promise<GatewayAdapter | null> {
  const cfg = await new DuesRepository(db).getGatewayConfig(orgId);
  if (!cfg || !cfg.encryptedWebhookSecret) return null;
  const secret = cfg.encryptedSecret
    ? decryptCredential(cfg.encryptedSecret, encryptionKey)
    : '';
  const webhookSecret = decryptCredential(cfg.encryptedWebhookSecret, encryptionKey);
  return buildAdapter(cfg.provider, secret, webhookSecret);
}

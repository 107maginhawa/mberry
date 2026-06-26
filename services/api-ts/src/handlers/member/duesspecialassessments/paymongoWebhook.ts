import type { ValidatedContext } from '@/types/app';
import type { PaymongoWebhookParams } from '@/generated/openapi/validators';

/**
 * paymongoWebhook — Receive a PayMongo webhook for one org and reconcile the matching payment.
 *
 * POST /webhooks/paymongo/{organizationId}
 * Auth: NONE (public; signature verified with per-org webhook secret)
 *
 * TODO(Task 8): replace stub with real implementation
 */
export async function paymongoWebhook(
  ctx: ValidatedContext<never, never, PaymongoWebhookParams>
): Promise<Response> {
  return ctx.json({ error: 'Not implemented' }, 501);
}

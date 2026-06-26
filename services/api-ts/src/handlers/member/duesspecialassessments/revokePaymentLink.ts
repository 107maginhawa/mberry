import type { ValidatedContext } from '@/types/app';
import type { RevokePaymentLinkParams } from '@/generated/openapi/validators';

/**
 * revokePaymentLink — Revoke an unused payment link. Officer only.
 *
 * POST /org/{organizationId}/payments/{tokenId}/revoke
 * Auth: bearer, association:admin | association:staff, x-require-officer
 *
 * TODO(Task 9): replace stub with real implementation
 */
export async function revokePaymentLink(
  ctx: ValidatedContext<never, never, RevokePaymentLinkParams>
): Promise<Response> {
  return ctx.json({ error: 'Not implemented' }, 501);
}
import type { ValidatedContext } from '@/types/app';
import type { RevokePaymentLinkParams } from '@/generated/openapi/validators';
import { PaymentTokenRepository } from '@/handlers/dues/repos/payment-token.repo';

/**
 * revokePaymentLink — Revoke an unused payment link. Officer only.
 *
 * POST /org/{organizationId}/payments/{tokenId}/revoke
 * Auth: bearer, association:admin | association:staff, x-require-officer
 *
 * 200 { revoked: true } — token stamped revoked_at; no further checkout possible.
 * 404 — token not found, belongs to a different org, or already used/revoked.
 *
 * Org scoping is enforced in-handler (not just at the route layer): a token that
 * exists but belongs to another org returns the same 404 as a missing token to
 * prevent cross-org existence leaks.
 */
export async function revokePaymentLink(
  ctx: ValidatedContext<never, never, RevokePaymentLinkParams>
): Promise<Response> {
  const { organizationId: orgId, tokenId } = ctx.req.valid('param');
  const db = ctx.get('database');
  const repo = new PaymentTokenRepository(db);

  const token = await repo.findById(tokenId);
  if (!token || token.organizationId !== orgId) {
    return ctx.json({ error: 'Not found' }, 404);
  }

  const ok = await repo.revoke(tokenId);
  if (!ok) {
    return ctx.json({ error: 'Link already used or revoked' }, 404);
  }

  return ctx.json({ revoked: true }, 200);
}
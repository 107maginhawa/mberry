/**
 * FIX-003 (G-02) — cross-org mutation guard.
 *
 * Lifecycle mutations (approve/deny/resign/terminate/decease/reinstate/renew/
 * update/delete/updateApplication) previously fetched the target record by id
 * and mutated it WITHOUT verifying that the record belongs to the caller's
 * organization. requirePosition() only proves the caller is an officer of
 * ctx.organizationId — it says nothing about the org of the record being
 * mutated. So an officer/admin of org A could mutate org B's records by id.
 *
 * This helper centralizes the same check getMembership already performs
 * (getMembership.ts:28–30): if the caller has an org context, the target
 * record's organizationId must match it.
 */

import { ForbiddenError } from '@/core/errors';

interface OrgScopedContext {
  get(key: 'organizationId'): string | undefined;
}

/**
 * Throw ForbiddenError if the target record's org does not match the caller's
 * org context. No-op when the caller has no org context (e.g. platform-admin
 * surfaces where org scoping is enforced elsewhere) or when the record carries
 * no organizationId.
 *
 * @param ctx           Handler context exposing get('organizationId').
 * @param recordOrgId   organizationId of the record being mutated.
 * @param resourceLabel Human-readable label for the error message.
 */
export function assertRecordInCallerOrg(
  ctx: OrgScopedContext,
  recordOrgId: string | null | undefined,
  resourceLabel = 'this resource',
): void {
  const orgId = ctx.get('organizationId');
  if (orgId && recordOrgId && recordOrgId !== orgId) {
    throw new ForbiddenError(`Access denied to ${resourceLabel}`);
  }
}

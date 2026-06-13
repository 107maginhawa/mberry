/**
 * verifyVendor
 *
 * Path: POST /association/marketplace/vendors/:vendorId/verify
 * OperationId: verifyVendor
 *
 * Officer review of a vendor's verification (BR-38). The officer's decision
 * drives the target transition through MARKETPLACE_VENDOR_VALID_TRANSITIONS:
 *   - verified  (approve): pending → verified | suspended → verified
 *   - rejected  (reject):  pending → rejected (terminal)
 *   - suspended (suspend): verified → suspended
 * Decision defaults to 'verified' when omitted (backward-compatible approve).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError } from '@/core/errors';
import {
  assertValidTransition,
  MARKETPLACE_VENDOR_VALID_TRANSITIONS,
} from '@/utils/status-transitions';
import { VendorRepository } from './repos/vendor.repo';

const VALID_DECISIONS = ['verified', 'rejected', 'suspended'] as const;
type VendorVerificationDecision = (typeof VALID_DECISIONS)[number];

export async function verifyVendor(ctx: ValidatedContext<any, never, any>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const { vendorId } = ctx.req.valid('param');
  const body = ctx.req.valid('json') ?? {};
  const decision: VendorVerificationDecision = body.decision ?? 'verified';
  if (!VALID_DECISIONS.includes(decision)) {
    throw new ValidationError(
      `Invalid decision '${decision}'. Allowed: ${VALID_DECISIONS.join(', ')}`,
    );
  }

  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'marketplace' }) ?? baseLogger;

  const repo = new VendorRepository(db, logger);

  const vendor = await repo.findOneById(vendorId);
  if (!vendor) {
    throw new NotFoundError('Vendor not found');
  }

  // Validate the requested transition up-front for a clear 409 (the repo
  // method re-asserts defensively for callers that bypass the handler).
  assertValidTransition(
    MARKETPLACE_VENDOR_VALID_TRANSITIONS,
    vendor.verificationStatus,
    decision,
    'vendor',
  );

  const updated =
    decision === 'verified'
      ? await repo.verifyVendor(vendorId, user.id)
      : decision === 'rejected'
        ? await repo.rejectVendor(vendorId, user.id)
        : await repo.suspendVendor(vendorId, user.id);

  // Audit (FIX-012): expose the actual verification decision on the per-route audit event.
  ctx.set('auditResourceId', vendorId);
  ctx.set('auditDescription', `Vendor ${vendorId} verification: ${decision} by ${user.id}`);

  logger?.info(
    { vendorId, decision, reviewedBy: user.id, action: 'review_vendor' },
    'Vendor verification reviewed',
  );

  return ctx.json(updated, 200);
}

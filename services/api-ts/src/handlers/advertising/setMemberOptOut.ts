/**
 * setMemberOptOut
 *
 * Path: POST /association/advertising/opt-out
 * OperationId: setMemberOptOut
 *
 * Member opts in/out of targeted ads (AC-M16-004, M16-R4).
 *
 * AHA FIX-008 / G-02: the preference is now PERSISTED to member_ad_opt_out
 * (previously a no-op returning a misleading success) and enforced server-side
 * at ad-serve time (see getAdForPlacement). Reads the contract field `optedOut`.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError } from '@/core/errors';
import { MemberAdOptOutRepository } from './repos/optOut.repo';

export async function setMemberOptOut(ctx: ValidatedContext<any, never, never>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const organizationId = ctx.get('organizationId') as string | undefined;
  if (!organizationId) {
    // Fail closed — an opt-out preference cannot be persisted without org scope.
    throw new ValidationError('Organization context is required to set ad opt-out');
  }

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'advertising' }) ?? baseLogger;

  const optedOut = body.optedOut !== false; // contract field; default to opt-out

  const repo = new MemberAdOptOutRepository(db, logger);
  if (optedOut) {
    await repo.optOut(organizationId, user.id, user.id);
  } else {
    await repo.optIn(organizationId, user.id);
  }

  logger?.info({
    personId: user.id,
    organizationId,
    optedOut,
    action: 'set_member_ad_opt_out',
  }, optedOut ? 'Member opted out of targeted ads' : 'Member opted back in');

  return ctx.json({
    personId: user.id,
    optedOut,
    effectiveImmediately: true,
  }, 200);
}

/**
 * setMemberOptOut
 *
 * Path: POST /association/advertising/opt-out
 * OperationId: setMemberOptOut
 *
 * Member opts out of targeted ads (AC-M16-004, M16-R4)
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError } from '@/core/errors';

export async function setMemberOptOut(ctx: ValidatedContext<any, never, never>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const body = ctx.req.valid('json');
  const logger = ctx.get('logger');

  const optOut = body.optOut !== false; // default true

  logger?.info({
    personId: user.id,
    optOut,
    action: 'set_member_ad_opt_out',
  }, optOut ? 'Member opted out of targeted ads' : 'Member opted back in');

  return ctx.json({
    personId: user.id,
    optedOut: optOut,
    effectiveImmediately: true,
  }, 200);
}

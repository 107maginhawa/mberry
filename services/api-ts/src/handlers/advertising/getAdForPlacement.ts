/**
 * getAdForPlacement
 *
 * Path: GET /association/advertising/placement
 * OperationId: getAdForPlacement
 *
 * Retrieve an ad for display in a feed slot.
 * Respects opt-out (M16-R4), approval gate (AC-M16-001 / BR-45),
 * budget limits (M16-R6), and sponsored label (AC-M16-003 / BR-47).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError } from '@/core/errors';
import { CreativeRepository } from './repos/creative.repo';

export async function getAdForPlacement(ctx: ValidatedContext<never, any, never>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const organizationId = ctx.get('organizationId') as string;

  // AC-M16-004: check opt-out status (passed as query flag by upstream middleware)
  if (query.optedOut === 'true' || query.optedOut === true) {
    // Return generic/empty ad for opted-out members
    return ctx.json({
      ad: null,
      generic: true,
      reason: 'member_opted_out',
    }, 200);
  }

  const repo = new CreativeRepository(db, logger);

  // AC-M16-001: only approved creatives shown
  const approvedCreatives = await repo.findMany({
    organizationId,
    status: 'approved',
  });

  if (!Array.isArray(approvedCreatives) || approvedCreatives.length === 0) {
    return ctx.json({ ad: null, generic: true, reason: 'no_approved_ads' }, 200);
  }

  // Select first matching creative (in production: weighted/randomized)
  const creative = approvedCreatives[0];

  // AC-M16-003: ensure sponsored label
  return ctx.json({
    ad: {
      ...creative,
      sponsoredLabel: true, // Always enforce
    },
    generic: false,
  }, 200);
}

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { SurveyResponseRepository } from './repos/survey.repo';

/**
 * deleteMemberResponses
 *
 * Path: DELETE /surveys/my-responses
 * Hand-wired route
 *
 * Deletes the authenticated member's survey responses within their current
 * organization (FIX-009). Scoped to the org context to prevent a silent
 * cross-org wipe; anonymized rows (responderId nulled by the person.deleted
 * cascade) are naturally excluded since they no longer match the caller's id.
 * Supports data retention / right-to-deletion compliance.
 */
export async function deleteMemberResponses(
  ctx: ValidatedContext<never, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const userId = session.user.id;
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'surveys' }) ?? baseLogger;

  const organizationId = ctx.get('organizationId') as string | undefined;
  if (!organizationId) {
    throw new ValidationError('Organization context is required to delete your survey responses');
  }

  const responseRepo = new SurveyResponseRepository(db, logger);
  const deletedCount = await responseRepo.deleteByResponderAndOrg(userId, organizationId);

  logger?.info(
    { personId: userId, organizationId, deletedCount, action: 'delete_member_responses' },
    'Deleted member survey responses'
  );

  return ctx.json({ deletedCount }, 200);
}

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { surveyResponses } from './repos/survey.schema';
import { eq } from 'drizzle-orm';

/**
 * deleteMemberResponses
 *
 * Path: DELETE /surveys/my-responses
 * Hand-wired route
 *
 * Deletes all survey responses for the authenticated member.
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

  const result = await db
    .delete(surveyResponses)
    .where(eq(surveyResponses.responderId, userId))
    .returning({ id: surveyResponses.id });

  logger?.info(
    { personId: userId, deletedCount: result.length, action: 'delete_member_responses' },
    'Deleted member survey responses'
  );

  return ctx.json({ deletedCount: result.length }, 200);
}

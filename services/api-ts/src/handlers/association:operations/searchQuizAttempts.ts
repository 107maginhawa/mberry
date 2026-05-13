import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SearchQuizAttemptsQuery } from '@/generated/openapi/validators';
import { QuizAttemptRepository } from './repos/training.repo';

/**
 * searchQuizAttempts
 *
 * Path: GET /association/training/courses/quiz-attempts
 * OperationId: searchQuizAttempts
 */
export async function searchQuizAttempts(
  ctx: ValidatedContext<never, SearchQuizAttemptsQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new QuizAttemptRepository(db, logger);

  const limit = Number((query as any)?.limit) || 20;
  const offset = Number((query as any)?.offset) || 0;

  const filters: any = {};
  if ((query as any)?.courseId) filters.courseId = (query as any).courseId;
  if ((query as any)?.personId) filters.personId = (query as any).personId;

  const results = await repo.findMany(filters, { pagination: { limit, offset } });
  const totalCount = await repo.count(filters);

  return ctx.json({ data: results, totalCount, limit, offset }, 200);
}

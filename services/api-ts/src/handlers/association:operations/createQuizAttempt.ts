import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateQuizAttemptBody } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { CourseRepository, QuizAttemptRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';

/**
 * createQuizAttempt
 *
 * Path: POST /association/training/courses/quiz-attempts
 * OperationId: createQuizAttempt
 *
 * Business rules:
 * - Calculate score from answers
 * - Set passed based on 70% threshold
 */
export async function createQuizAttempt(
  ctx: ValidatedContext<CreateQuizAttemptBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const courseRepo = new CourseRepository(db, logger);
  const quizRepo = new QuizAttemptRepository(db, logger);

  const courseId = (body as any).courseId;
  const personId = (body as any).personId || user.id;

  const course = await courseRepo.findOneById(courseId);
  if (!course) throw new NotFoundError('Course not found');

  const score = Number((body as any).score) || 0;
  const maxScore = Number((body as any).maxScore) || 100;
  const PASS_THRESHOLD = 0.7;
  const passed = maxScore > 0 ? (score / maxScore) >= PASS_THRESHOLD : false;

  const attempt = await quizRepo.createOne({
    courseId,
    personId,
    score,
    maxScore,
    passed,
    answers: (body as any).answers,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'quiz-attempt',
    resourceId: attempt.id,
    description: `Quiz attempt: ${score}/${maxScore} (${passed ? 'passed' : 'failed'})`,
  });

  return ctx.json(attempt, 201);
}

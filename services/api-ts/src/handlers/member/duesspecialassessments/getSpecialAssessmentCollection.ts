/**
 * getSpecialAssessmentCollection
 *
 * GET /association/member/special-assessments/{id}/collection
 * Returns collection metrics (total, paid, pending counts + amounts).
 */
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { SpecialAssessmentRepository } from '@/handlers/association:member/repos/special-assessments.repo';

export async function getSpecialAssessmentCollection(
  ctx: ValidatedContext<never, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Authentication required' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new SpecialAssessmentRepository(db);

  const assessment = await repo.findById(params.id);
  if (!assessment) return ctx.json({ error: 'Assessment not found' }, 404);

  const metrics = await repo.getCollectionMetrics(assessment.id);
  if (!metrics) return ctx.json({ error: 'Assessment not found' }, 404);

  return ctx.json(metrics, 200);
}

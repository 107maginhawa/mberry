/**
 * deleteSpecialAssessment
 *
 * DELETE /association/member/special-assessments/{id}
 * Soft-deletes (sets status=closed). Draft only — 409 if active/closed (BR-T8-001).
 */
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { SpecialAssessmentRepository } from './repos/special-assessments.repo';

export async function deleteSpecialAssessment(
  ctx: ValidatedContext<never, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Authentication required' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new SpecialAssessmentRepository(db);

  const existing = await repo.findById(params.id);
  if (!existing) return ctx.json({ error: 'Assessment not found' }, 404);

  // BR-T8-001: reject delete if not draft
  if (existing.status !== 'draft') {
    return ctx.json({ error: 'Cannot delete assessment with status: ' + existing.status }, 409);
  }

  const deleted = await repo.softDelete(params.id);
  return ctx.json({ message: 'Assessment deleted', assessment: deleted }, 200);
}

/**
 * updateSpecialAssessment
 *
 * PUT /association/member/special-assessments/{id}
 * Updates assessment fields. Draft status only — 409 if active/closed (BR-T8-001).
 */
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { SpecialAssessmentRepository } from './repos/special-assessments.repo';

export async function updateSpecialAssessment(
  ctx: ValidatedContext<any, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Authentication required' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param') ?? ctx.get('_params') ?? (ctx as any)._params;
  const body = ctx.req.valid('json') ?? ctx.get('_body') ?? (ctx as any)._body;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new SpecialAssessmentRepository(db);

  const existing = await repo.findById(params.id);
  if (!existing) return ctx.json({ error: 'Assessment not found' }, 404);

  // BR-T8-001: reject update if not draft
  if (existing.status !== 'draft') {
    return ctx.json({ error: 'Cannot update assessment with status: ' + existing.status }, 409);
  }

  const updated = await repo.update(params.id, {
    name: body.name,
    description: body.description,
    amount: body.amount,
    currency: body.currency,
    dueDate: body.dueDate,
    fundId: body.fundId,
    appliesTo: body.appliesTo,
  });

  return ctx.json(updated, 200);
}

/**
 * createSpecialAssessment
 *
 * POST /association/member/special-assessments
 * Creates a special assessment in draft status. Officer auth required.
 */
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { SpecialAssessmentRepository } from './repos/special-assessments.repo';

export async function createSpecialAssessment(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Authentication required' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const body = ctx.req.valid('json');
  const organizationId = ctx.get('organizationId') as string;
  

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new SpecialAssessmentRepository(db);

  const assessment = await repo.create({
    organizationId,
    name: body.name,
    description: body.description ?? null,
    amount: body.amount,
    currency: body.currency ?? 'PHP',
    dueDate: body.dueDate,
    fundId: body.fundId ?? null,
    appliesTo: body.appliesTo ?? 'all',
    status: 'draft',
    createdBy: session!.user.id,
  });

  return ctx.json(assessment, 201);
}

/**
 * listSpecialAssessments
 *
 * GET /association/member/special-assessments/{orgId}
 * Lists assessments with collection summary. Officer auth required.
 */
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { SpecialAssessmentRepository } from '@/handlers/association:member/repos/special-assessments.repo';

export async function listSpecialAssessments(
  ctx: ValidatedContext<never, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Authentication required' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const organizationId = ctx.get('organizationId') as string;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new SpecialAssessmentRepository(db);

  const assessments = await repo.listByOrg(organizationId);

  // Attach collection summary to each assessment
  const withCollection = await Promise.all(
    assessments.map(async (a) => {
      const collection = await repo.getCollectionMetrics(a.id);
      return { ...a, collection };
    }),
  );

  return ctx.json({ assessments: withCollection }, 200);
}

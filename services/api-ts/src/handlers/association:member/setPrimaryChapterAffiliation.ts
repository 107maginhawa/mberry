import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SetPrimaryChapterAffiliationParams } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { ChapterAffiliationRepository } from './repos/chapters.repo';

/**
 * setPrimaryChapterAffiliation
 *
 * Path: POST /association/member/chapter-affiliations/{affiliationId}/set-primary
 * OperationId: setPrimaryChapterAffiliation
 */
export async function setPrimaryChapterAffiliation(
  ctx: ValidatedContext<never, never, SetPrimaryChapterAffiliationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const { affiliationId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ChapterAffiliationRepository(db, ctx.get('logger'));

  const updated = await repo.setPrimary(affiliationId, orgId);

  ctx.set('auditResourceId', affiliationId);
  ctx.set('auditDescription', 'Primary chapter affiliation set');

  return ctx.json(updated, 200);
}

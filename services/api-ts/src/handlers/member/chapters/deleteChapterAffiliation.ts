import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteChapterAffiliationParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { ChapterAffiliationRepository } from '@/handlers/association:member/repos/chapters.repo';

/**
 * deleteChapterAffiliation
 *
 * Path: DELETE /association/member/chapter-affiliations/{affiliationId}
 * OperationId: deleteChapterAffiliation
 */
export async function deleteChapterAffiliation(
  ctx: ValidatedContext<never, never, DeleteChapterAffiliationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { affiliationId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ChapterAffiliationRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(affiliationId);
  if (!existing) throw new NotFoundError('Chapter affiliation');

  await repo.deleteOneById(affiliationId);

  ctx.set('auditResourceId', affiliationId);
  ctx.set('auditDescription', 'Chapter affiliation deleted');

  return ctx.body(null, 204);
}

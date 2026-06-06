import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateChapterAffiliationBody, UpdateChapterAffiliationParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { ChapterAffiliationRepository } from './repos/chapters.repo';
import type { ChapterAffiliation } from './repos/chapters.schema';

/**
 * updateChapterAffiliation
 *
 * Path: PATCH /association/member/chapter-affiliations/{affiliationId}
 * OperationId: updateChapterAffiliation
 */
export async function updateChapterAffiliation(
  ctx: ValidatedContext<UpdateChapterAffiliationBody, never, UpdateChapterAffiliationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { affiliationId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ChapterAffiliationRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(affiliationId);
  if (!existing) throw new NotFoundError('Chapter affiliation');

  const updated = await repo.updateOneById(affiliationId, body as Partial<ChapterAffiliation>);

  ctx.set('auditResourceId', affiliationId);
  ctx.set('auditDescription', 'Chapter affiliation updated');

  return ctx.json(updated, 200);
}

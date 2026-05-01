import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetChapterAffiliationParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { ChapterAffiliationRepository } from './repos/chapters.repo';

/**
 * getChapterAffiliation
 *
 * Path: GET /association/member/chapter-affiliations/{affiliationId}
 * OperationId: getChapterAffiliation
 */
export async function getChapterAffiliation(
  ctx: ValidatedContext<never, never, GetChapterAffiliationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ChapterAffiliationRepository(db, ctx.get('logger'));

  const affiliation = await repo.findOneById((params as any).affiliationId);
  if (!affiliation) throw new NotFoundError('Chapter affiliation');

  return ctx.json(affiliation, 200);
}

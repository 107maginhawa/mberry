import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateChapterAffiliationBody } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { ChapterAffiliationRepository } from './repos/chapters.repo';
import { auditAction } from '@/utils/audit';

/**
 * createChapterAffiliation
 *
 * Path: POST /association/member/chapter-affiliations
 * OperationId: createChapterAffiliation
 */
export async function createChapterAffiliation(
  ctx: ValidatedContext<CreateChapterAffiliationBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new ChapterAffiliationRepository(db, logger);

  const affiliation = await repo.createOne({
    orgId,
    personId: body.personId,
    chapterId: body.chapterId,
    isPrimary: body.isPrimary ?? false,
    affiliatedAt: new Date(),
    status: 'active',
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'chapter-affiliation',
    resourceId: affiliation.id,
    description: 'Chapter affiliation created',
  });

  return ctx.json(affiliation, 201);
}

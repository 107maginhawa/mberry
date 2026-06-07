import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { sql } from 'drizzle-orm';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { chapterAffiliations } from '@/handlers/association:member/repos/chapters.schema';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';

/**
 * listOrgChapters
 *
 * Path: GET /association/member/chapters
 *
 * Returns the distinct list of chapters in the current org (resolved from
 * orgContextMiddleware) — used by the directory profile filter UI.
 * Role: association:member (read-only).
 *
 * Implementation: SELECT DISTINCT chapter_id from chapter_affiliation for
 * the current org, joined to organizations table for chapter display name.
 */
export async function listOrgChapters(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId') as string | undefined;
  if (!orgId) {
    throw new ValidationError('Organization context required');
  }

  const db = ctx.get('database') as DatabaseInstance;

  const rows = await db
    .selectDistinct({
      chapterId: chapterAffiliations.chapterId,
      chapterName: organizations.name,
    })
    .from(chapterAffiliations)
    .leftJoin(organizations, sql`${organizations.id} = ${chapterAffiliations.chapterId}`)
    .where(sql`${chapterAffiliations.organizationId} = ${orgId}
               AND ${chapterAffiliations.status} = 'active'`);

  const data = rows.map((r) => ({
    id: r.chapterId,
    chapterId: r.chapterId,
    chapterName: r.chapterName ?? undefined,
  }));

  return ctx.json({ data }, 200);
}

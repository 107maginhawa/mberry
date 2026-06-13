import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SearchDocumentsQuery } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { DocumentRepository } from './repos/documents.repo';
import { requireOfficerTerm } from '@/core/auth/officer-checks';

/**
 * searchDocuments
 *
 * Path: GET /association/documents
 * OperationId: searchDocuments
 */
export async function searchDocuments(
  ctx: ValidatedContext<never, SearchDocumentsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  const query = ctx.req.valid('query');
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  // Resolve officer status once — drives both the accessLevel downgrade and
  // the status (publish-visibility) enforcement below.
  const isOfficer = (await requireOfficerTerm(ctx)) === null;

  // P0-04: Override caller-provided accessLevel based on role.
  // Members can only see 'public' and 'internal' documents.
  // Only officers/admins can access 'privileged' or 'restricted'.
  const PRIVILEGED_LEVELS = ['privileged', 'restricted', 'confidential'];
  let effectiveAccessLevel = query.accessLevel;
  if (effectiveAccessLevel && PRIVILEGED_LEVELS.includes(effectiveAccessLevel) && !isOfficer) {
    // Downgrade to 'tenantOnly' — don't expose privileged docs to non-officers
    effectiveAccessLevel = 'tenantOnly';
  }

  // FIX-004 (WF-073 publish semantics): non-officers may only see published
  // documents. Drafts/archived are officer work-in-progress. Officers may
  // optionally narrow by a status filter; with no filter they see all statuses.
  const effectiveStatus = isOfficer ? query.status : 'published';

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DocumentRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    {
      organizationId: orgId,
      ownerId: query.ownerId,
      ownerType: query.ownerType,
      accessLevel: effectiveAccessLevel,
      category: query.category,
      status: effectiveStatus,
      tag: query.tag,
      q: query.q,
    },
    { pagination: { offset, limit } },
  );

  const totalPages = Math.ceil(result.totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return ctx.json({
    data: result.data,
    pagination: {
      offset,
      limit,
      count: result.data.length,
      totalCount: result.totalCount,
      totalPages,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  }, 200);
}

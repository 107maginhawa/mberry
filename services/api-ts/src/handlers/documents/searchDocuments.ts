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

  // P0-04: Override caller-provided accessLevel based on role.
  // Members can only see 'public' and 'internal' documents.
  // Only officers/admins can access 'privileged' or 'restricted'.
  const PRIVILEGED_LEVELS = ['privileged', 'restricted', 'confidential'];
  let effectiveAccessLevel = query.accessLevel;
  if (effectiveAccessLevel && PRIVILEGED_LEVELS.includes(effectiveAccessLevel)) {
    const officerDenied = await requireOfficerTerm(ctx);
    if (officerDenied) {
      // Downgrade to 'tenantOnly' — don't expose privileged docs to non-officers
      effectiveAccessLevel = 'tenantOnly';
    }
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DocumentRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    {
      organizationId: orgId,
      ownerId: query.ownerId,
      ownerType: query.ownerType,
      accessLevel: effectiveAccessLevel,
      category: query.category,
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

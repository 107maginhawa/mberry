import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListCredentialTemplatesQuery } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { CredentialTemplateRepository } from './repos/credentials.repo';

/**
 * listCredentialTemplates
 *
 * Path: GET /association/member/credential-templates
 * OperationId: listCredentialTemplates
 */
export async function listCredentialTemplates(
  ctx: ValidatedContext<never, ListCredentialTemplatesQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const tenantId = ctx.get('tenantId');
  const query = ctx.req.valid('query');
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new CredentialTemplateRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    {
      tenantId,
      type: query.type,
      status: query.status,
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

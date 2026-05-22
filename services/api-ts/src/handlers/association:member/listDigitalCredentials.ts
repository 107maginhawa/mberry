import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListDigitalCredentialsQuery } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { DigitalCredentialRepository } from './repos/credentials.repo';

/**
 * listDigitalCredentials
 *
 * Path: GET /association/member/credentials
 * OperationId: listDigitalCredentials
 */
export async function listDigitalCredentials(
  ctx: ValidatedContext<never, ListDigitalCredentialsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  const query = ctx.req.valid('query');
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DigitalCredentialRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    {
      organizationId: orgId,
      personId: query.personId,
      templateId: query.templateId,
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

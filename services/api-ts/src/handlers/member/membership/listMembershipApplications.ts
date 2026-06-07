import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListMembershipApplicationsQuery } from '@/generated/openapi/validators';
import { MembershipApplicationRepository } from '@/handlers/association:member/repos/membership.repo';
import { persons } from '@/handlers/person/repos/person.schema';
import { inArray } from 'drizzle-orm';

/**
 * listMembershipApplications
 *
 * Path: GET /association/member/applications
 * OperationId: listMembershipApplications
 */
export async function listMembershipApplications(
  ctx: ValidatedContext<never, ListMembershipApplicationsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  const query = ctx.req.valid('query');
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipApplicationRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    {
      organizationId: orgId,
      status: (query as Record<string, unknown>)['status'] as string | undefined,
    },
    { pagination: { offset, limit } },
  );

  // Enrich with person names
  const personIds = [...new Set(result.data.map((a: Record<string, unknown>) => a['personId'] as string).filter(Boolean))];
  const personMap: Record<string, { firstName: string; lastName: string; email?: string; avatar?: unknown }> = {};
  if (personIds.length > 0) {
    const personRows = await db
      .select({ id: persons.id, firstName: persons.firstName, lastName: persons.lastName, contactInfo: persons.contactInfo, avatar: persons.avatar })
      .from(persons)
      .where(inArray(persons.id, personIds));
    for (const p of personRows) {
      personMap[p.id] = {
        firstName: p.firstName ?? '',
        lastName: p.lastName ?? '',
        email: (p.contactInfo as Record<string, unknown> | null)?.['email'] as string ?? '',
        avatar: p.avatar ?? null,
      };
    }
  }

  const enriched = result.data.map((app: Record<string, unknown>) => {
    const person = personMap[app['personId'] as string];
    return {
      ...app,
      name: person ? `${person.firstName} ${person.lastName}`.trim() : undefined,
      email: person?.email,
      avatar: person?.avatar,
    };
  });

  const totalPages = Math.ceil(result.totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return ctx.json({
    data: enriched,
    pagination: {
      offset,
      limit,
      count: enriched.length,
      totalCount: result.totalCount,
      totalPages,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  }, 200);
}

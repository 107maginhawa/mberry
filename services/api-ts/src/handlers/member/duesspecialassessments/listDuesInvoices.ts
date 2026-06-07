import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { ListDuesInvoicesQuery } from '@/generated/openapi/validators';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';
import { sql } from 'drizzle-orm';
import { persons } from '@/handlers/person/repos/person.schema';

/**
 * listDuesInvoices
 *
 * Path: GET /association/member/dues-invoices
 * OperationId: listDuesInvoices
 */
export async function listDuesInvoices(
  ctx: ValidatedContext<never, ListDuesInvoicesQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  if (!orgId) throw new ForbiddenError();
  const query = ctx.req.valid('query') as Record<string, unknown>;
  const offset = Number(query['offset']) || 0;
  const limit = Math.min(Number(query['limit']) || 20, 100);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesInvoiceRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    {
      organizationId: orgId,
      membershipId: query['membershipId'] as string | undefined,
      status: query['status'] as 'generated' | 'cancelled' | 'sent' | 'paid' | 'overdue' | 'writtenOff' | undefined,
    },
    { pagination: { offset, limit } },
  );

  // Enrich invoices with person names
  const personIds = [...new Set(result.data.map((inv: any) => inv.personId).filter(Boolean))];
  const personMap = new Map<string, { firstName: string | null; lastName: string | null }>();
  if (personIds.length > 0) {
    const personRows = await db
      .select({ id: persons.id, firstName: persons.firstName, lastName: persons.lastName })
      .from(persons)
      .where(sql`${persons.id} IN (${sql.join(personIds.map(id => sql`${id}::uuid`), sql`, `)})`);
    for (const p of personRows) {
      personMap.set(String(p.id), { firstName: p.firstName, lastName: p.lastName });
    }
  }
  const enriched = result.data.map((inv: any) => {
    const person = personMap.get(inv.personId);
    return {
      ...inv,
      memberName: person ? [person.firstName, person.lastName].filter(Boolean).join(' ') : null,
    };
  });

  const totalPages = Math.ceil(result.totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return ctx.json({
    data: enriched,
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

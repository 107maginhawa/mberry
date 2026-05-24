import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import type { GetDuesInvoiceParams } from '@/generated/openapi/validators';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { sql } from 'drizzle-orm';
import { persons } from '../person/repos/person.schema';

/**
 * getDuesInvoice
 *
 * Path: GET /association/member/dues-invoices/{invoiceId}
 * OperationId: getDuesInvoice
 */
export async function getDuesInvoice(
  ctx: ValidatedContext<never, never, GetDuesInvoiceParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  if (!orgId) throw new ForbiddenError();

  const { invoiceId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesInvoiceRepository(db, ctx.get('logger'));

  const invoice = await repo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('DuesInvoice');
  if (invoice.organizationId !== orgId) throw new ForbiddenError();

  let memberName: string | null = null;
  if (invoice.personId) {
    const [person] = await db
      .select({ firstName: persons.firstName, lastName: persons.lastName })
      .from(persons)
      .where(sql`${persons.id} = ${invoice.personId}::uuid`)
      .limit(1);
    if (person) {
      memberName = [person.firstName, person.lastName].filter(Boolean).join(' ') || null;
    }
  }

  return ctx.json({ ...invoice, memberName }, 200);
}

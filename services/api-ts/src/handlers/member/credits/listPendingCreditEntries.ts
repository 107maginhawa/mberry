import { eq, and, desc } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListPendingCreditEntriesParams } from '@/generated/openapi/validators';
import { creditEntries } from '@/handlers/association:member/repos/credits.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * listPendingCreditEntries
 *
 * Path: GET /credit-compliance/{organizationId}/pending
 * OperationId: listPendingCreditEntries
 *
 * Officer-level list of member self-logged CPD credit entries awaiting
 * verification for an organization. Mirrors the dues payment-proof review
 * queue (listPendingProofs) — lists entries with verificationStatus='pending'
 * AND status='active', joined to person for the member's display name.
 *
 * Position-restricted: President, Secretary, Treasurer (inline carve-out — the
 * route is not under an org-context middleware that derives the title, and the
 * org comes from the path param like getCreditCompliance).
 */
export async function listPendingCreditEntries(
  ctx: ValidatedContext<never, never, ListPendingCreditEntriesParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId: orgId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  // The route is not under the /association/* org-context middleware, so the
  // org for requirePosition is derived from the path param (mirrors
  // getCreditCompliance).
  ctx.set('organizationId', orgId);
  const denied = await requirePosition(ctx, [
    POSITION_TITLES.PRESIDENT,
    POSITION_TITLES.SECRETARY,
    POSITION_TITLES.TREASURER,
  ]);
  if (denied) return denied;

  // Join to person for the member display name (mirrors how compliance reads
  // resolve first/last name from the person record).
  const rows = await db
    .select({
      id: creditEntries.id,
      personId: creditEntries.personId,
      firstName: persons.firstName,
      lastName: persons.lastName,
      activityName: creditEntries.activityName,
      provider: creditEntries.provider,
      activityDate: creditEntries.activityDate,
      creditAmount: creditEntries.creditAmount,
      category: creditEntries.category,
      supportingDocumentId: creditEntries.supportingDocumentId,
      verificationStatus: creditEntries.verificationStatus,
      createdAt: creditEntries.createdAt,
    })
    .from(creditEntries)
    .innerJoin(persons, eq(persons.id, creditEntries.personId))
    .where(
      and(
        eq(creditEntries.organizationId, orgId),
        eq(creditEntries.verificationStatus, 'pending'),
        eq(creditEntries.status, 'active'),
      ),
    )
    .orderBy(desc(creditEntries.createdAt));

  const entries = rows.map((r) => ({
    id: r.id,
    personId: r.personId,
    memberName: [r.firstName, r.lastName].filter(Boolean).join(' ').trim(),
    activityName: r.activityName,
    ...(r.provider ? { provider: r.provider } : {}),
    activityDate: r.activityDate.toISOString(),
    // credit_amount is doublePrecision (float8) — return the raw JS number.
    // No Number()/String() coercion (it is already a number on the wire).
    creditAmount: r.creditAmount,
    ...(r.category ? { category: r.category } : {}),
    ...(r.supportingDocumentId ? { supportingDocumentId: r.supportingDocumentId } : {}),
    verificationStatus: r.verificationStatus,
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
  }));

  return ctx.json({ entries }, 200);
}

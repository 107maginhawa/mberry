import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListRosterMembersQuery } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * listRosterMembers
 *
 * Path: GET /association/member/roster
 * OperationId: listRosterMembers
 *
 * OPS-01: Returns per-member dues status and training compliance in a single request.
 * OPS-04: Supports DB-level filtering by duesStatus and trainingCompliant.
 * T-21-02: Officer-gated — Secretary, President, or Society Officer only.
 */
export async function listRosterMembers(
  ctx: ValidatedContext<never, ListRosterMembersQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  // T-21-02: Restrict access to officer positions
  const denied = await requirePosition(ctx, [
    POSITION_TITLES.SECRETARY,
    POSITION_TITLES.PRESIDENT,
    POSITION_TITLES.SOCIETY_OFFICER,
  ]);
  if (denied) return denied;

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // OPS-01/OPS-04: Use enriched query with dues + training subqueries + DB-level filters
  let result: Awaited<ReturnType<typeof repo.listMembersWithOfficerStatus>>;
  try {
    result = await repo.listMembersWithOfficerStatus({
      organizationId: query.organizationId,
      status: query.status,
      categoryId: query.categoryId,
      search: query.q ?? query.search,
      duesStatus: query.duesStatus,
      trainingCompliant: query.trainingCompliant,
      limit: pageSize,
      offset,
    });
  } catch (err: unknown) {
    const baseLogger = ctx.get('logger');
    const traceId = ctx.get('requestId');
    const logger = baseLogger?.child?.({ traceId, module: 'association:member' }) ?? baseLogger;
    logger?.error({ action: 'listRosterMembers.1', err, organizationId: query.organizationId }, 'Roster query failed');
    return ctx.json({ error: 'Failed to load roster' }, 500);
  }

  // Flatten nested { membership, person, category } + officer status fields
  const data = result.data.map((row: Record<string, unknown>) => {
    const m = (row['membership'] || row) as Record<string, unknown>;
    const p = (row['person'] || {}) as Record<string, unknown>;
    const c = (row['category'] || {}) as Record<string, unknown>;
    return {
      id: m['id'],
      personId: m['personId'] || p['id'],
      firstName: p['firstName'] || null,
      lastName: p['lastName'] || null,
      name: [p['firstName'], p['lastName']].filter(Boolean).join(' ') || null,
      email: p['email'] || null,
      avatar: p['avatar'] || null,
      memberNumber: m['memberNumber'] || null,
      categoryId: m['categoryId'] || null,
      categoryName: c['name'] || null,
      status: m['status'] || 'pending',
      duesExpiryDate: m['duesExpiryDate'] || null,
      gracePeriodDays: m['gracePeriodDays'] || 30,
      joinedAt: m['joinedAt'] || m['createdAt'] || null,
      startDate: m['startDate'] || null,
      organizationId: m['organizationId'] || null,
      // OPS-01: officer-status fields
      duesInvoiceStatus: row['duesInvoiceStatus'] ?? null,
      creditsEarned: row['creditsEarned'] ?? 0,
      trainingCompliant: row['trainingCompliant'] ?? false,
    };
  });

  return ctx.json({ data, totalCount: result.total }, 200);
}

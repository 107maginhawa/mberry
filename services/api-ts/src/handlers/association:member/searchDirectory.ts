import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SearchDirectoryQuery } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { DirectoryProfileRepository } from './repos/directory.repo';
import { batchLoadTrustSignals } from './utils/trust-signals';

/**
 * searchDirectory
 *
 * Path: GET /association/member/directory/search
 * OperationId: searchDirectory
 *
 * Supports text search (q) plus structured filters: chapter, duesStatus, tier.
 * Returns trust-enriched profiles with verification badges, CE indicators,
 * and dues standing — all privacy-gated per profile owner's settings.
 */
export async function searchDirectory(
  ctx: ValidatedContext<never, SearchDirectoryQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  // EF-M04: Verify caller is a member of the org whose directory they're searching
  const orgMembership = ctx.get('orgMembership');
  if (!orgMembership) {
    return ctx.json({ error: 'Organization membership required' }, 403);
  }

  const orgId = ctx.get('organizationId');
  const query = ctx.req.valid('query');
  const qr = query as Record<string, string>;
  const q = qr['q'] || undefined;
  const chapter = qr['chapter'] || undefined;
  const duesStatus = qr['duesStatus'] || undefined;
  const tier = qr['tier'] || undefined;
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DirectoryProfileRepository(db, ctx.get('logger'));

  const user = ctx.get('user') as { role?: string } | undefined;
  const isAdmin = user?.role === 'admin';

  const { data, totalCount } = await repo.searchWithFilters(
    { organizationId: orgId, q, chapter, duesStatus: duesStatus === 'current' ? 'current' : undefined, tier },
    { offset, limit },
  );

  // Batch-load trust signals (context-injectable for test isolation)
  const personIds = data.map(p => p.personId);
  // Test-injectable override for trust signals loader (uses unknown cast — ctx.var doesn't include test-only keys)
  const loadTrustSignals = ((ctx as unknown as { get(k: string): unknown }).get('_batchLoadTrustSignals') as typeof batchLoadTrustSignals | undefined) ?? batchLoadTrustSignals;
  const trustMap = await loadTrustSignals(db, personIds, orgId!, isAdmin);

  const enrichedData = data.map(profile => ({
    ...profile,
    trustSignals: trustMap.get(profile.personId) ?? {
      duesStatus: null, credentialCount: 0, ceCreditsEarned: 0, hasVerifiedLicense: false,
    },
  }));

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return ctx.json({
    data: enrichedData,
    pagination: {
      offset, limit, count: enrichedData.length, totalCount, totalPages, currentPage,
      hasNextPage: currentPage < totalPages, hasPreviousPage: currentPage > 1,
    },
  }, 200);
}

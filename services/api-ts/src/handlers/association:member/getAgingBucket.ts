import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { GetAgingBucketParams } from '@/generated/openapi/validators';
import { AgingBucketRepository } from './repos/dues.repo';

/**
 * getAgingBucket
 *
 * Path: GET /association/member/aging-buckets/{organizationId}
 * OperationId: getAgingBucket
 */
export async function getAgingBucket(
  ctx: ValidatedContext<never, never, GetAgingBucketParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId } = ctx.req.valid('param');
  const orgId = ctx.get('orgId');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new AgingBucketRepository(db, ctx.get('logger'));

  // Find the latest aging bucket for this organization
  const result = await repo.findMany({ organizationId: orgId });
  const latest = result.length > 0 ? result[result.length - 1] : null;

  if (latest) {
    return ctx.json(latest, 200);
  }

  // Return empty defaults if no aging bucket exists yet
  return ctx.json({
    organizationId,
    asOfDate: new Date().toISOString().split('T')[0],
    current: 0,
    thirtyDay: 0,
    sixtyDay: 0,
    ninetyDay: 0,
    overNinety: 0,
    totalOutstanding: 0,
  }, 200);
}

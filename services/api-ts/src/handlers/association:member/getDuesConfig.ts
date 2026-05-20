import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { GetDuesConfigParams } from '@/generated/openapi/validators';
import { DuesConfigRepository } from './repos/dues.repo';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';

/**
 * getDuesConfig
 *
 * Path: GET /association/member/dues-configs/{duesConfigId}
 * OperationId: getDuesConfig
 *
 * Accepts either a duesConfigId or an organizationId — the frontend
 * passes the orgId as the path param to fetch config by org.
 */
export async function getDuesConfig(
  ctx: ValidatedContext<never, never, GetDuesConfigParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { duesConfigId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  // Try by ID first, then fall back to lookup by organizationId
  const repo = new DuesConfigRepository(db, ctx.get('logger'));
  let config = await repo.findOneById(duesConfigId);

  if (!config) {
    // Frontend may pass orgId as the param — look up by org
    const duesRepo = new DuesRepository(db);
    config = (await duesRepo.getConfig(duesConfigId)) ?? null;
  }

  if (!config) {
    // Return 404 so the SDK creates an SdkError(404) which shouldRetry skips
    // immediately — avoids the response transformer crashing on {}.annualAmount
    // and triggering 3 retries with exponential backoff (7.5s total delay).
    return ctx.json({ data: null }, 404);
  }

  // Map DB field names to TypeSpec schema names so the SDK response transformer
  // (which expects annualAmount, effectiveDate) doesn't crash on undefined fields.
  const c = config as Record<string, unknown>;
  return ctx.json({
    ...c,
    annualAmount: (c['defaultAmount'] as number) ?? (c['annualAmount'] as number) ?? 0,
    effectiveDate: (c['effectiveDate'] as string) ?? (c['createdAt'] as string) ?? new Date().toISOString(),
  }, 200);
}

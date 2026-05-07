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
    config = (await duesRepo.getConfig(duesConfigId)) as any;
  }

  if (!config) {
    // Return empty config rather than 404 — org may not have configured dues yet
    return ctx.json({}, 200);
  }

  return ctx.json(config, 200);
}

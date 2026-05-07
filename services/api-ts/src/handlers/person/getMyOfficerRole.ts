import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { GetMyOfficerRoleParams } from '@/generated/openapi/validators';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

/**
 * getMyOfficerRole
 *
 * Path: GET /officer-role/{orgId}
 * OperationId: getMyOfficerRole
 */
export async function getMyOfficerRole(
  ctx: ValidatedContext<never, never, GetMyOfficerRoleParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const params = ctx.req.valid('param');
  const personId = session.user.id;
  const orgId = (params as any).orgId;

  const repo = new OfficerTermRepository(db, logger);
  const terms = await repo.findActiveByPersonAndOrg(personId, orgId);

  return ctx.json({ data: terms }, 200);
}

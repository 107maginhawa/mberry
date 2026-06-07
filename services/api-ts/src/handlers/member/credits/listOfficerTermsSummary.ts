import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListOfficerTermsSummaryParams } from '@/generated/openapi/validators';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

/**
 * listOfficerTermsSummary
 *
 * Path: GET /officer-terms/{orgId}
 * OperationId: listOfficerTermsSummary
 */
export async function listOfficerTermsSummary(
  ctx: ValidatedContext<never, never, ListOfficerTermsSummaryParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const params = ctx.req.valid('param');
  const { organizationId: orgId } = params as { organizationId: string };

  const repo = new OfficerTermRepository(db, logger);
  const terms = await repo.findByOrg(orgId);

  return ctx.json({ data: terms, total: terms.length }, 200);
}

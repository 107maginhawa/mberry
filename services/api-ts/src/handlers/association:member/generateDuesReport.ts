import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { GenerateDuesReportQuery, GenerateDuesReportParams } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';

/**
 * generateDuesReport
 *
 * Path: GET /association/member/dues-reporting/{organizationId}/report
 * OperationId: generateDuesReport
 */
export async function generateDuesReport(
  ctx: ValidatedContext<never, GenerateDuesReportQuery, GenerateDuesReportParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId } = ctx.req.valid('param');
  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const from = query.from ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const to = query.to ?? new Date();

  const data = await repo.reportCollectionSummary(organizationId, from, to);

  return ctx.json({ data }, 200);
}

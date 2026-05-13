import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { RunDunningBody } from '@/generated/openapi/validators';
import { DunningTemplateRepository } from './repos/dunning.repo';
import { DunningEventRepository } from './repos/dunning.repo';

/**
 * runDunning
 *
 * Path: POST /association/member/dunning/run
 * OperationId: runDunning
 *
 * Evaluates overdue memberships against active dunning templates.
 * In dryRun mode, only counts — does not create events.
 */
export async function runDunning(
  ctx: ValidatedContext<RunDunningBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const templateRepo = new DunningTemplateRepository(db, logger);
  const eventRepo = new DunningEventRepository(db, logger);

  const requestOrgId = body.organizationId || orgId;
  const dryRun = body.dryRun ?? false;

  // Get all active templates for this organization
  const templates = await templateRepo.findMany({
    organizationId: requestOrgId,
    status: 'active',
  });

  // In a full implementation, we would query overdue memberships
  // and match them against template daysAfterDue thresholds.
  // For now, return the evaluation summary with templates found.
  const evaluated = templates.length;
  let sent = 0;

  if (!dryRun && templates.length > 0) {
    // Future: iterate overdue memberships and create events per template match
    // For each overdue member matching a template's stage/daysAfterDue:
    //   await eventRepo.logDunningEvent({ ... })
    //   sent++
    sent = 0; // No members evaluated yet — needs overdue membership query
  }

  return ctx.json({
    evaluated,
    sent,
    dryRun,
  }, 200);
}

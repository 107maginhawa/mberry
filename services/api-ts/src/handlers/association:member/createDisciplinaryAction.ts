import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { DisciplinaryActionRepository } from './repos/governance.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { domainEvents } from '@/core/domain-events';

/**
 * createDisciplinaryAction
 *
 * Path: POST /association/member/disciplinary-actions
 * OperationId: createDisciplinaryAction
 *
 * M4-R4: Disciplinary actions require a mandatory reason and are immutable after creation.
 * M4-R2: President-only authorization.
 */
export async function createDisciplinaryAction(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');

  // M4-R4: Mandatory reason — reject if missing or empty
  if (!body.reason || body.reason.trim().length === 0) {
    return ctx.json({ error: 'Reason is required for disciplinary actions' }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DisciplinaryActionRepository(db, logger);

  const action = await repo.create({
    organizationId: orgId,
    targetPersonId: body.targetPersonId,
    issuedBy: user.id,
    actionType: body.actionType,
    reason: body.reason.trim(),
    effectiveDate: new Date(body.effectiveDate),
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    notes: body.notes || null,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'disciplinary-action',
    resourceId: action.id,
    description: `Disciplinary action (${body.actionType}) issued`,
    details: { targetPersonId: body.targetPersonId, actionType: body.actionType },
  });

  if (body.actionType === 'suspension') {
    domainEvents.emit('member.suspended', {
      disciplinaryActionId: action.id,
      personId: body.targetPersonId,
      organizationId: orgId,
      actionType: body.actionType,
      issuedBy: user.id,
      expiresAt: body.expiresAt ?? null,
    }).catch(() => {});
  } else if (body.actionType === 'removal' || body.actionType === 'expulsion') {
    domainEvents.emit('member.removed', {
      disciplinaryActionId: action.id,
      personId: body.targetPersonId,
      organizationId: orgId,
      issuedBy: user.id,
    }).catch(() => {});
  }

  return ctx.json(action, 201);
}

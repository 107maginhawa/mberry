import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ForbiddenError } from '@/core/errors';
import { OfficerTermRepository, PositionRepository } from './repos/governance.repo';
import { PlatformAdminRepository } from '@/handlers/platformadmin/repos/platform-admin.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { domainEvents } from '@/core/domain-events';

/**
 * createOfficerTerm
 *
 * Path: POST /association/member/officer-terms
 * OperationId: createOfficerTerm
 */
export async function createOfficerTerm(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new OfficerTermRepository(db, logger);

  // BR-09e: President position assignment requires platform admin
  const positionRepo = new PositionRepository(db);
  const targetPosition = await positionRepo.findById(body.positionId);
  if (targetPosition && targetPosition.title.toLowerCase() === 'president') {
    const adminRepo = new PlatformAdminRepository(db, logger);
    const callerAdmin = await adminRepo.findById(user.id);
    if (!callerAdmin) {
      throw new ForbiddenError(
        'Assigning the President position requires platform administrator privileges',
      );
    }
  }

  // M4-R1: One person per role — check no active holder exists for this position.
  // Exception: Board Member allows multiple simultaneous holders.
  const isBoardMember =
    targetPosition?.title.toLowerCase() === POSITION_TITLES.BOARD_MEMBER.toLowerCase();
  if (!isBoardMember) {
    const existingHolder = await repo.findActiveByPosition(body.positionId);
    if (existingHolder) {
      return ctx.json(
        { error: 'Position already has an active officer. Remove the current officer before assigning a new one.' },
        409,
      );
    }
  }

  // M4-R1: One role per person per org — check person doesn't already hold a role
  const personActiveTerms = await repo.findActiveByPersonInOrg(body.personId, orgId);
  if (personActiveTerms.length > 0) {
    return ctx.json(
      { error: 'Person already holds an active officer role in this organization.' },
      409,
    );
  }

  const term = await repo.create({
    organizationId: orgId,
    positionId: body.positionId,
    personId: body.personId,
    startDate: new Date(body.startDate),
    endDate: body.endDate ? new Date(body.endDate) : null,
    status: body.status || 'upcoming',
    notes: body.notes || null,
  });

  ctx.set('auditResourceId', term.id);
  ctx.set('auditDescription', 'Officer term created');
  ctx.set('auditDetails', { positionId: body.positionId, personId: body.personId });

  domainEvents.emit('officer.assigned', {
    termId: term.id,
    personId: body.personId,
    positionId: body.positionId,
    organizationId: orgId,
    assignedBy: user.id,
  }).catch(() => {});

  return ctx.json(term, 201);
}

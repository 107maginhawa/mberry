import type { Context } from 'hono';
import { NotFoundError, BusinessLogicError, UnauthorizedError } from '@/core/errors';
import { ElectionsRepository } from './repos/elections.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { domainEvents } from '@/core/domain-events';
import { auditAction } from '@/core/audit/audit-action';
import { assertValidTransition, ELECTION_VALID_TRANSITIONS } from '@/utils/status-transitions';

export async function updateElectionStatus(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  // Elections require president authorization
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const db = ctx.get('database');
  const id = ctx.req.param('id')!;
  const body = await ctx.req.json();
  const repo = new ElectionsRepository(db);

  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Election not found');

  assertValidTransition(ELECTION_VALID_TRANSITIONS, existing.status, body.status, 'election');

  // BR-33: Minimum 2 candidates per position before voting opens
  if (body.status === 'votingOpen') {
    const nomineeCounts = await repo.countNomineesByPosition(id);
    const underMin = nomineeCounts.filter(p => p.count < 2);
    if (underMin.length > 0) {
      throw new BusinessLogicError(
        `Cannot open voting: ${underMin.length} position(s) have fewer than 2 candidates. Use manual override or add more candidates.`,
        'INSUFFICIENT_CANDIDATES',
      );
    }
  }

  const extra: any = {};
  if (body.status === 'published') extra.publishedAt = new Date();

  const updated = await repo.update(id, { status: body.status, ...extra });

  // Cascade: withdraw all non-terminal nominees when election is cancelled
  if (body.status === 'cancelled') {
    await repo.withdrawAllNominees(id);
  }

  domainEvents.emit('election.status.changed', {
    electionId: id,
    organizationId: existing.organizationId,
    oldStatus: existing.status,
    newStatus: body.status,
    changedBy: session.user.id,
  }).catch(() => {});

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'election',
    resourceId: id,
    description: `Election status changed from '${existing.status}' to '${body.status}'`,
    details: { from: existing.status, to: body.status },
    eventSubType: body.status === 'published' ? 'governance.election-closed' : 'governance.election-created',
  });

  return ctx.json({ data: updated }, 200);
}

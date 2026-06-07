import type { Context } from 'hono';
import { NotFoundError, ConflictError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import type { Session } from '@/types/auth';
import type { JobScheduler } from '@/core/jobs';

export async function checkIn(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;

  // Only officers can perform check-ins [BR-17]
  const orgId = ctx.get('organizationId');
  if (orgId) {
    const officerRepo = new OfficerTermRepository(db);
    const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, orgId);
    if (terms.length === 0) {
      throw new ForbiddenError('Officer access required to perform check-ins');
    }
  }

  const eventId = ctx.req.param('id')!;
  const body = await ctx.req.json();
  const repo = new EventsRepository(db);

  const event = await repo.get(eventId);
  if (!event) throw new NotFoundError('Event not found');

  // [M8-R6] Block check-in after event status = completed
  if (event.status === 'completed') {
    throw new BusinessLogicError(
      'Check-in is not available after event completion.',
      'EVENT_COMPLETED'
    );
  }

  const alreadyCheckedIn = await repo.isCheckedIn(eventId, body.personId);
  if (alreadyCheckedIn) throw new ConflictError('Already checked in');

  // Build attestation metadata for compliance
  const userAgent = ctx.req.header('user-agent') ?? 'unknown';
  const attestation = {
    officerId: session.user.id,
    method: body.method ?? 'manual',
    deviceInfo: userAgent.substring(0, 200),
    timestamp: new Date().toISOString(),
  };

  const attendance = await repo.checkIn({
    eventId,
    personId: body.personId,
    method: body.method ?? 'manual',
    checkedInBy: session.user.id,
    organizationId: event.organizationId,
    attestation,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  // Emit pg-boss job for credit pipeline (consumed by Wave 2b)
  try {
    const jobs = ctx.get('jobs') as JobScheduler | undefined;
    if (jobs && event.creditBearing && event.creditAmount && event.creditAmount > 0) {
      await jobs.trigger('attendance.confirmed', {
        eventId,
        personId: body.personId,
        organizationId: event.organizationId,
        creditAmount: event.creditAmount,
        cpdActivityType: event.cpdActivityType,
        attestation,
        checkinId: attendance.id,
      });
    }
  } catch (err) {
    // Non-blocking — credit pipeline failure shouldn't prevent check-in
    const baseLogger = ctx.get('logger');
    const traceId = ctx.get('requestId');
    const logger = baseLogger?.child?.({ traceId, module: 'events' }) ?? baseLogger;
    logger?.warn({ action: 'checkIn.1', error: err, eventId }, 'Failed to enqueue attendance.confirmed job');
  }

  // Post-event NPS survey trigger (non-blocking)
  try {
    const npsJobs = ctx.get('jobs') as JobScheduler | undefined;
    if (npsJobs) {
      await npsJobs.trigger('survey.postEventNps', {
        eventId,
        personId: body.personId,
        organizationId: event.organizationId,
      });
    }
  } catch (err) {
    ctx.get('logger')?.warn({ error: err, eventId }, 'Failed to enqueue survey.postEventNps');
  }

  return ctx.json({ data: attendance }, 201);
}

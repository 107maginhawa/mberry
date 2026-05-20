import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { NotificationService } from '@/core/notifs';
import type { PromoteWaitlistEntryParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { WaitlistEntryRepository, EventRegistrationRepository } from './repos/events.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { notifyWaitlistPromotion } from '@/handlers/notifs/notification-triggers';

/**
 * promoteWaitlistEntry
 *
 * Path: POST /association/events/{eventId}/waitlist/{entryId}/promote
 * OperationId: promoteWaitlistEntry
 *
 * Moves a waitlisted person to confirmed by creating a registration.
 */
export async function promoteWaitlistEntry(
  ctx: ValidatedContext<never, never, PromoteWaitlistEntryParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const waitlistRepo = new WaitlistEntryRepository(db, logger);
  const regRepo = new EventRegistrationRepository(db, logger);

  const entry = await waitlistRepo.findOneById(params.entryId);
  if (!entry) throw new NotFoundError('Waitlist entry not found');

  // Mark waitlist entry as promoted
  await waitlistRepo.updateOneById(entry.id, { promotedAt: new Date() });

  // Create confirmed registration
  const registration = await regRepo.createOne({
    eventId: entry.eventId,
    personId: entry.personId,
    status: 'confirmed',
    organizationId: orgId,
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'waitlist-entry',
    resourceId: entry.id,
    description: 'Waitlist entry promoted to confirmed registration',
  });

  // GAP-003: Notify promoted member
  const notifService = ctx.get('notifs') as NotificationService;
  if (notifService) {
    await notifyWaitlistPromotion(notifService, {
      organizationId: orgId,
      personId: entry.personId,
      eventId: entry.eventId,
      // eventName is not in WaitlistEntry schema — requires JOIN with event table
      eventName: (entry as unknown as Record<string, unknown>)['eventName'] as string | undefined || 'Event',
      position: entry.position || 0,
    });
  }

  return ctx.json(registration, 201);
}

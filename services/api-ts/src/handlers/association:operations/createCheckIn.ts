import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateCheckInBody } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { EventRepository, CheckInRepository } from './repos/events.repo';
import { verifyQrToken } from './utils/qr-checkin';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * createCheckIn
 *
 * Path: POST /association/events/checkins
 * OperationId: createCheckIn
 *
 * Supports both QR and manual check-in methods.
 */
export async function createCheckIn(
  ctx: ValidatedContext<CreateCheckInBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const checkInRepo = new CheckInRepository(db, logger);
  const eventRepo = new EventRepository(db, logger);

  let eventId = (body as any).eventId;
  const method: 'qr' | 'manual' = (body as any).method || 'manual';
  const personId = (body as any).personId || user.id;

  // QR token verification
  if (method === 'qr' && (body as any).qrToken) {
    const secret = process.env['QR_SECRET'] || 'default-qr-secret';
    const payload = verifyQrToken((body as any).qrToken, secret);
    if (!payload) {
      throw new BusinessLogicError('Invalid or expired QR token', 'INVALID_QR_TOKEN');
    }
    eventId = payload.eventId;
  }

  if (!eventId) {
    throw new BusinessLogicError('eventId is required', 'MISSING_EVENT_ID');
  }

  const event = await eventRepo.findOneById(eventId);
  if (!event) throw new NotFoundError('Event not found');

  const checkIn = await checkInRepo.createOne({
    eventId,
    personId,
    method,
    checkedInBy: user.id,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'check-in',
    resourceId: checkIn.id,
    description: `Check-in via ${method}`,
  });

  return ctx.json(checkIn, 201);
}

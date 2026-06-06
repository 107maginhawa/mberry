import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { PublishEventParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { EventRepository } from './repos/events.repo';
import { domainEvents } from '@/core/domain-events';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * publishEvent
 *
 * Path: POST /association/events/{eventId}/publish
 * OperationId: publishEvent
 */
export async function publishEvent(
  ctx: ValidatedContext<never, never, PublishEventParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRepository(db, logger);

  const existing = await repo.findOneById(params.eventId);
  if (!existing) throw new NotFoundError('Event not found');

  if (existing.status !== 'draft') {
    throw new BusinessLogicError('Only draft events can be published', 'INVALID_STATUS');
  }

  // [S6] Block publishing paid events if org has no Stripe account
  if (existing.registrationFee && existing.registrationFee > 0) {
    const { MerchantAccountRepository } = await import('@/handlers/billing/repos/billing.repo');
    const merchantRepo = new MerchantAccountRepository(db);
    const merchants = await merchantRepo.findMany({ organizationId: existing.organizationId, active: true });
    const merchant = merchants[0];
    const stripeAccountId = merchant?.metadata
      ? (merchant.metadata as Record<string, unknown>)?.['stripeAccountId']
      : undefined;
    if (!stripeAccountId) {
      throw new BusinessLogicError(
        'Set up billing before publishing a paid event. Go to Settings → Billing to connect your Stripe account.',
        'STRIPE_NOT_ONBOARDED'
      );
    }
  }

  const published = await repo.publish(params.eventId);

  domainEvents.emit('event.published', {
    eventId: published.id,
    organizationId: published.organizationId,
    publishedBy: user.id,
  }).catch(() => {});

  ctx.set('auditResourceId', published.id);
  ctx.set('auditDescription', 'Event published');

  return ctx.json(published, 200);
}

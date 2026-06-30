import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { PublishEventParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { EventRepository } from './repos/events.repo';
import { domainEvents } from '@/core/domain-events';

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

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRepository(db, logger);

  const existing = await repo.findOneById(params.eventId);
  if (!existing) throw new NotFoundError('Event not found');

  if (existing.status !== 'draft') {
    throw new BusinessLogicError('Only draft events can be published', 'INVALID_STATUS');
  }

  // [S6 / 7d] Block publishing a paid event unless the org can take payment — on EITHER rail:
  // a Stripe merchant account (legacy) OR a connected PayMongo gateway (the lean rail).
  if (existing.registrationFee && existing.registrationFee > 0) {
    const { MerchantAccountRepository } = await import('@/handlers/billing/repos/billing.repo');
    const merchantRepo = new MerchantAccountRepository(db);
    const merchants = await merchantRepo.findMany({ organizationId: existing.organizationId, active: true });
    const merchant = merchants[0];
    const stripeAccountId = merchant?.metadata
      ? (merchant.metadata as Record<string, unknown>)?.['stripeAccountId']
      : undefined;

    const { DuesRepository } = await import('@/handlers/dues/repos/dues-payments.repo');
    const gatewayCfg = await new DuesRepository(db).getGatewayConfig(existing.organizationId);
    const paymongoConnected = !!(gatewayCfg?.connected && gatewayCfg?.encryptedSecret);

    if (!stripeAccountId && !paymongoConnected) {
      throw new BusinessLogicError(
        'Connect online payments before publishing a paid event — set up PayMongo in Payment settings (or connect Stripe).',
        'PAYMENT_NOT_ONBOARDED'
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

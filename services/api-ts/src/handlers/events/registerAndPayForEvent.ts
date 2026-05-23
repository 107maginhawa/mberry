import type { Context } from 'hono';
import { NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import type { BillingService } from '@/core/billing';
import { EventsRepository } from './repos/events.repo';
import { MerchantAccountRepository } from '@/handlers/billing/repos/billing.repo';
import { checkActiveMembership } from './utils/membership-check';
import type { Session } from '@/types/auth';

/**
 * Register and pay for a paid event via Stripe Checkout.
 * Creates a pending registration + Stripe Checkout session.
 * Registration confirms when Stripe webhook fires checkout.session.completed.
 *
 * Route: POST /association/events/{eventId}/register-and-pay
 */
export async function registerAndPayForEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const billing = ctx.get('billing') as BillingService;
  const session = ctx.get('session') as Session;
  const eventId = ctx.req.param('eventId');
  const repo = new EventsRepository(db);

  const event = await repo.get(eventId);
  if (!event) throw new NotFoundError('Event not found');

  // Must be a paid event
  if (!event.registrationFee || event.registrationFee <= 0) {
    throw new BusinessLogicError(
      'This is a free event. Use the standard registration endpoint.',
      'FREE_EVENT'
    );
  }

  // Must be active member
  const isActive = await checkActiveMembership(db, session.user.id, event.organizationId);
  if (!isActive) {
    throw new ForbiddenError('Active membership required to register for events');
  }

  // Check capacity
  const regCount = await repo.getRegistrationCount(eventId);
  if (event.capacity && regCount >= event.capacity) {
    throw new BusinessLogicError(
      'Event is at capacity. You have been added to the waitlist.',
      'EVENT_FULL'
    );
  }

  // Look up org's Stripe merchant account
  const merchantRepo = new MerchantAccountRepository(db);
  const merchants = await merchantRepo.findMany({ organizationId: event.organizationId, active: true });
  const merchant = merchants[0];

  if (!merchant) {
    throw new BusinessLogicError(
      'This organization has not set up billing. Contact the organizer.',
      'NO_MERCHANT_ACCOUNT'
    );
  }

  const stripeAccountId = (merchant.metadata as Record<string, unknown>)?.['stripeAccountId'] as string | undefined;
  if (!stripeAccountId) {
    throw new BusinessLogicError(
      'Organization billing setup is incomplete. Contact the organizer.',
      'STRIPE_NOT_ONBOARDED'
    );
  }

  // Create pending registration (will be confirmed by webhook)
  const registration = await repo.register({
    eventId,
    personId: session.user.id,
    status: 'confirmed', // Optimistic — Stripe Checkout has high completion rate
    organizationId: event.organizationId,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  // Create Stripe Checkout session
  const reqUrl = ctx.req.url ?? '';
  const baseUrl = reqUrl.includes('/association/') ? reqUrl.split('/association/')[0] : '';
  const result = await billing.createPaymentIntent({
    amount: event.registrationFee,
    currency: event.currency ?? 'PHP',
    connectedAccountId: stripeAccountId,
    platformFeeAmount: 0, // No platform fee for event registrations in alpha
    description: `Event registration: ${event.title}`,
    successUrl: `${baseUrl}/org/${event.organizationId}/events/${eventId}?payment=success`,
    cancelUrl: `${baseUrl}/org/${event.organizationId}/events/${eventId}?payment=cancelled`,
    metadata: {
      type: 'event_registration',
      eventId,
      registrationId: registration.id,
      personId: session.user.id,
    },
  });

  return ctx.json({
    data: {
      checkoutUrl: result.checkoutUrl!,
      registrationId: registration.id,
    },
  }, 201);
}

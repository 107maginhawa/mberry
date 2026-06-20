import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { BillingService } from '@/core/billing';
import type { Session } from '@/types/auth';
import {
  ForbiddenError,
  NotFoundError,
  BusinessLogicError,
} from '@/core/errors';
import type { RegisterAndPayForEventParams } from '@/generated/openapi/validators';
import { EventRepository, EventRegistrationRepository } from './repos/events.repo';
import { MerchantAccountRepository } from '@/handlers/billing/repos/billing.repo';
import { checkActiveMembership } from '@/handlers/events/utils/membership-check';

/**
 * registerAndPayForEvent
 *
 * Register and pay for a paid event via Stripe Checkout.
 * Creates a pending registration + Stripe Checkout session.
 * Registration confirms when Stripe webhook fires checkout.session.completed.
 *
 * Path: POST /association/event-lifecycle/{eventId}/register-and-pay
 * OperationId: registerAndPayForEvent
 */
export async function registerAndPayForEvent(
  ctx: ValidatedContext<never, never, RegisterAndPayForEventParams>
): Promise<Response> {
  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const billing = ctx.get('billing') as BillingService;
  const session = ctx.get('session') as Session;

  const eventRepo = new EventRepository(db);
  const regRepo = new EventRegistrationRepository(db);

  const event = await eventRepo.findOneById(params.eventId);
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
  const regCount = await regRepo.count({ eventId: params.eventId });
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

  // Create pending registration (confirmed optimistically — Stripe Checkout has high completion rate)
  const registration = await regRepo.createOne({
    eventId: params.eventId,
    personId: session.user.id,
    status: 'confirmed',
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
    platformFeeAmount: 0,
    description: `Event registration: ${event.title}`,
    successUrl: `${baseUrl}/org/${event.organizationId}/events/${params.eventId}?payment=success`,
    cancelUrl: `${baseUrl}/org/${event.organizationId}/events/${params.eventId}?payment=cancelled`,
    metadata: {
      type: 'event_registration',
      eventId: params.eventId,
      registrationId: registration.id,
      personId: session.user.id,
      // The webhook intake (stripeWebhook.ts) writes webhook_retry_log.organization_id
      // (NOT NULL) from metadata.orgId/organizationId. Without these the real event
      // webhook dead-letters at intake on an empty-string uuid. Mirror the dues checkout.
      orgId: event.organizationId,
      organizationId: event.organizationId,
    },
  });

  return ctx.json({
    data: {
      checkoutUrl: result.checkoutUrl!,
      registrationId: registration.id,
    },
  }, 201);
}
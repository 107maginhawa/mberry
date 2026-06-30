import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { Config } from '@/core/config';
import type { Session } from '@/types/auth';
import { ForbiddenError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { RegisterAndPayForEventViaPaymongoParams } from '@/generated/openapi/validators';
import { EventRepository, EventRegistrationRepository } from './repos/events.repo';
import { resolveCheckoutAdapter, GatewayNotConfiguredError } from '@/handlers/dues/utils/resolve-gateway';
import { checkActiveMembership } from '@/handlers/events/utils/membership-check';
import { persons } from '@/handlers/person/repos/person.schema';

async function resolveMemberEmail(db: DatabaseInstance, personId: string): Promise<string> {
  const [row] = await db.select({ contactInfo: persons.contactInfo }).from(persons).where(eq(persons.id, personId)).limit(1);
  return row?.contactInfo?.email ?? '';
}

/**
 * registerAndPayForEventViaPaymongo
 *
 * The PayMongo sibling of registerAndPayForEvent (Stripe). Registers an active member for a
 * paid event and creates a PayMongo Checkout session against the ORG's OWN connected account
 * (the lean rail). The registration settles when the PayMongo webhook fires
 * (paymongoWebhook → metadata.type === 'event_registration' → stamps event_registration.paid_at).
 *
 * Path: POST /association/event-lifecycle/{eventId}/register-and-pay-paymongo
 */
export async function registerAndPayForEventViaPaymongo(
  ctx: ValidatedContext<never, never, RegisterAndPayForEventViaPaymongoParams>
): Promise<Response> {
  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const config = ctx.get('config') as Config;
  const session = ctx.get('session') as Session;

  const eventRepo = new EventRepository(db);
  const regRepo = new EventRegistrationRepository(db);

  const event = await eventRepo.findOneById(params.eventId);
  if (!event) throw new NotFoundError('Event not found');

  // Must be a paid event.
  if (!event.registrationFee || event.registrationFee <= 0) {
    throw new BusinessLogicError('This is a free event. Use the standard registration endpoint.', 'FREE_EVENT');
  }

  // Must be an active member of the org.
  const isActive = await checkActiveMembership(db, session.user.id, event.organizationId);
  if (!isActive) {
    throw new ForbiddenError('Active membership required to register for events');
  }

  // Capacity.
  const regCount = await regRepo.count({ eventId: params.eventId });
  if (event.capacity && regCount >= event.capacity) {
    throw new BusinessLogicError('Event is at capacity. You have been added to the waitlist.', 'EVENT_FULL');
  }

  // Resolve the org's PayMongo connected-account adapter (per-org keys). Unconfigured → friendly 400.
  let adapter;
  try {
    adapter = await resolveCheckoutAdapter(db, event.organizationId, config.auth.secret);
  } catch (err) {
    if (err instanceof GatewayNotConfiguredError) {
      throw new BusinessLogicError(
        'This organization has not connected PayMongo yet. Contact the organizer.',
        'PAYMONGO_NOT_CONFIGURED',
      );
    }
    throw err;
  }

  // Create the registration (confirmed optimistically; the unique active-registration index
  // rejects a duplicate with 23505 → "already registered"). Settles to paid via the webhook.
  const registration = await regRepo.createOne({
    eventId: params.eventId,
    personId: session.user.id,
    status: 'confirmed',
    organizationId: event.organizationId,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  const reqUrl = ctx.req.url ?? '';
  const baseUrl = reqUrl.includes('/association/') ? reqUrl.split('/association/')[0] : '';
  let result;
  try {
    result = await adapter.createCheckout(
      {
        amount: event.registrationFee,
        currency: event.currency ?? 'PHP',
        description: `Event registration: ${event.title}`,
        email: await resolveMemberEmail(db, session.user.id),
        successUrl: `${baseUrl}/events/${params.eventId}?payment=success`,
        cancelUrl: `${baseUrl}/events/${params.eventId}?payment=cancelled`,
        metadata: {
          // The webhook settles an event registration by these fields (mirrors processStripePayment).
          type: 'event_registration',
          eventId: params.eventId,
          registrationId: registration.id,
          personId: session.user.id,
          orgId: event.organizationId,
          organizationId: event.organizationId,
        },
      },
      randomUUID(),
    );
  } catch (err) {
    // Compensate: a failed checkout must not leave a confirmed-unpaid row holding a seat (the
    // unique active-registration index would also lock the member out of retrying). Remove it.
    await regRepo.deleteOneById(registration.id, session.user.id);
    throw err;
  }

  return ctx.json(
    {
      data: {
        checkoutUrl: result.checkoutUrl ?? '',
        registrationId: registration.id,
      },
    },
    201,
  );
}

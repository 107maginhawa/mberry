import type { Context } from 'hono';
import { NotFoundError, BusinessLogicError, ConflictError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import { checkActiveMembership } from './utils/membership-check';
import type { Session } from '@/types/auth';
import { domainEvents } from '@/core/domain-events';

export async function registerForEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const eventId = ctx.req.param('id')!;
  const repo = new EventsRepository(db);

  const event = await repo.get(eventId);
  if (!event) throw new NotFoundError('Event not found');

  // [M8-R1] Block direct registration for paid events — requires payment gateway
  if (event.registrationFee && event.registrationFee > 0) {
    throw new BusinessLogicError(
      'Paid event requires payment before registration. Use the payment gateway.',
      'PAYMENT_REQUIRED'
    );
  }

  // [BR-02] Only active members can register for events
  const isActive = await checkActiveMembership(db, session.user.id, event.organizationId);
  if (!isActive) {
    throw new BusinessLogicError('Active membership required to register for events');
  }

  // P0 RACE FIX + P1 single-row transition: capacity check + insert/transition
  // is atomic inside registerAtomic (event-row lock + confirmed-count + existing
  // -row lookup + guarded insert/update in one transaction). The repo returns an
  // `outcome` discriminator so the handler can branch on registration semantics
  // without re-querying:
  //   - 'created' / 'reactivated' → new active row (fresh insert OR a terminal
  //     row — cancelled/refunded/noShow — transitioned back to active). 201.
  //   - 'idempotent' + 'confirmed' → already actively registered → 409 conflict.
  //   - 'idempotent' + 'waitlisted' → already on the waitlist → graceful 200,
  //     NOT a 23505/"already registered" error. Promotion happens via the
  //     waitlist-promotion path, not here.
  // The 23505 catch remains the backstop for a genuinely concurrent double
  // INSERT (two registrants with no existing row racing the unique index).
  let registration;
  try {
    registration = await repo.registerAtomic({
      eventId,
      personId: session.user.id,
      organizationId: event.organizationId,
      capacity: event.capacity ?? null,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });
  } catch (error: unknown) {
    const dbError = error as { code?: string };
    if (dbError?.code === '23505') {
      throw new ConflictError('You are already registered for this event');
    }
    throw error;
  }

  const { outcome, ...data } = registration;

  // Already actively confirmed → idempotent conflict (no duplicate row created).
  if (outcome === 'idempotent' && data.status === 'confirmed') {
    throw new ConflictError('You are already registered for this event');
  }

  // Already on the waitlist → return current state gracefully (no error, no new row).
  if (outcome === 'idempotent' && data.status === 'waitlisted') {
    return ctx.json({ data }, 200);
  }

  // Fresh active registration ('created') or re-activated terminal row
  // ('reactivated') → emit the domain event and return 201.
  domainEvents.emit('event.registered', {
    eventId,
    personId: session.user.id,
    organizationId: event.organizationId,
    // registerAtomic only ever yields 'confirmed' | 'waitlisted' here; narrow the
    // wider DB enum type to match the domain-event payload contract.
    status: data.status as 'confirmed' | 'waitlisted',
  }).catch(() => {});

  return ctx.json({ data }, 201);
}

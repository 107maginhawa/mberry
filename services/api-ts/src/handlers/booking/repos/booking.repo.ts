/**
 * BookingRepository - Data access layer for bookings
 * Handles CRUD operations for booking management
 */

import { eq, and, or, gte, lte, inArray, isNull, desc, asc, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
// DatabaseInstance is used both as the constructor arg and the tx adapter type below.
import { DatabaseRepository, type PaginationOptions } from '@/core/database.repo';
import { BusinessLogicError } from '@/core/errors';

/** Valid booking status transitions — used by handlers for guard logic. */
export const VALID_BOOKING_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show_client', 'no_show_host'],
  rejected: [],              // terminal
  cancelled: [],             // terminal
  completed: [],             // terminal
  no_show_client: [],        // terminal
  no_show_host: [],          // terminal
};

export function validateBookingTransition(current: string, target: string): void {
  const allowed = VALID_BOOKING_TRANSITIONS[current] ?? [];
  if (!allowed.includes(target)) {
    throw new BusinessLogicError(
      `Invalid booking status transition from '${current}' to '${target}'`,
      'INVALID_BOOKING_TRANSITION',
    );
  }
}
import {
  bookings,
  timeSlots,
  type Booking,
  type NewBooking,
  type BookingCreateRequest,
  type TimeSlot
} from './booking.schema';
import { bookingEvents } from './booking.schema';
import { persons } from '../../person/repos/person.schema';
import { NotFoundError, ConflictError, ValidationError } from '@/core/errors';
import { InvoiceRepository } from '../../billing/repos/billing.repo';
import { assertValidTransition } from '@/utils/status-transitions';
import { BOOKING_VALID_TRANSITIONS } from '../utils/status-transitions';

export interface BookingFilters {
  client?: string;
  host?: string;
  clientOrHost?: string;
  status?: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed' | 'no_show_client' | 'no_show_host';
  dateRange?: { start: Date; end: Date };
  upcoming?: boolean;
  past?: boolean;
}

export interface BookingWithDetails extends Booking {
  clientDetails?: any;
  hostDetails?: any;
  slotDetails?: TimeSlot;
}

export class BookingRepository extends DatabaseRepository<Booking, NewBooking, BookingFilters> {  constructor(
    db: DatabaseInstance,
    logger?: any
  ) {
    super(db, bookings, logger);
  }

  /**
   * Build where conditions for booking filtering
   */
  protected buildWhereConditions(filters?: BookingFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.client) {
      conditions.push(eq(bookings.client, filters.client));
    }

    if (filters.host) {
      conditions.push(eq(bookings.host, filters.host));
    }

    if (filters.clientOrHost) {
      conditions.push(
        or(
          eq(bookings.client, filters.clientOrHost),
          eq(bookings.host, filters.clientOrHost)
        )
      );
    }

    if (filters.status) {
      conditions.push(eq(bookings.status, filters.status));
    }

    if (filters.dateRange) {
      conditions.push(
        and(
          gte(bookings.scheduledAt, filters.dateRange.start),
          lte(bookings.scheduledAt, filters.dateRange.end)
        )
      );
    }    if (filters.upcoming) {
      conditions.push(
        and(
          gte(bookings.scheduledAt, new Date()),
          inArray(bookings.status, ['pending', 'confirmed'])
        )
      );
    }

    if (filters.past) {
      conditions.push(
        or(
          lte(bookings.scheduledAt, new Date()),
          inArray(bookings.status, ['completed', 'cancelled', 'no_show_client', 'no_show_host'])
        )
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Create a booking with slot validation
   */
  async createBooking(
    clientId: string,
    slotId: string,
    request: BookingCreateRequest,
    organizationId?: string
  ): Promise<BookingWithDetails> {
    this.logger?.debug({ clientId, slotId, request }, 'Creating booking');

    // Get slot with event details to check for billingConfig
    const slotWithEvent = await this.db.select()
      .from(timeSlots)
      .leftJoin(bookingEvents, eq(timeSlots.event, bookingEvents.id))
      .where(eq(timeSlots.id, slotId))
      .limit(1);

    if (!slotWithEvent[0]) {
      throw new NotFoundError('Time slot not found');
    }

    const slot = slotWithEvent[0]['time_slot'];
    const event = slotWithEvent[0]['booking_event'];

    if (slot.status !== 'available') {
      throw new ConflictError('Time slot is not available');
    }

    // Calculate duration in minutes
    const duration = Math.floor(
      (slot.endTime.getTime() - slot.startTime.getTime()) / 60000
    );

    // Pre-generate booking ID for invoice context
    const bookingId = crypto.randomUUID();

    // Check for billing configuration (slot-level overrides event-level)
    const billingConfig = slot.billingConfig || event?.billingConfig;

    // P0 RACE FIX: the read above (slot.status check) is NOT a lock — two
    // concurrent requests can both see 'available' and proceed. Make the whole
    // reserve→book→invoice sequence atomic in a single transaction and let the
    // database be the arbiter:
    //   1. Conditional UPDATE flips the slot 'available' → 'booked' RETURNING.
    //      Exactly one concurrent tx wins this row; the loser gets 0 rows.
    //   2. The booking insert is additionally guarded by the partial unique
    //      index bookings_active_slot_unique (slot WHERE status IN active).
    //      A 23505 here means another active booking already holds the slot.
    //   3. Invoice is created LAST, inside the same tx, only after the slot is
    //      ours — so a losing request never leaves an orphan invoice, and an
    //      invoice failure rolls back the booking + slot reservation.
    const bookingData: NewBooking = {
      id: bookingId,
      client: clientId,
      host: slot.owner,
      slot: slotId,
      locationType: request.locationType || slot.locationTypes[0],
      reason: request.reason,
      status: 'pending',
      scheduledAt: slot.startTime,
      durationMinutes: duration,
      formResponses: request.formResponses,
      // Audit fields - booking created by client
      createdBy: clientId,
      updatedBy: clientId
    };

    let booking: Booking;
    let invoiceId: string | null = null;

    try {
      booking = await this.db.transaction(async (tx) => {
        // 1. Atomically claim the slot WITHOUT setting booking_id yet. Only an
        //    'available' slot flips 'available' → 'booked'; a slot already
        //    'booked'/'blocked' by a racing tx returns 0 rows (loser → Conflict).
        //    We do NOT set booking_id here because the FK target (the booking
        //    row) does not exist yet — setting it now would violate
        //    time_slot_booking_id_booking_id_fk and 500 the request.
        const claimed = await tx
          .update(timeSlots)
          .set({ status: 'booked' })
          .where(and(eq(timeSlots.id, slotId), eq(timeSlots.status, 'available')))
          .returning({ id: timeSlots.id });

        if (claimed.length === 0) {
          throw new ConflictError('Slot no longer available');
        }

        // 2. Create the booking (partial unique index is the backstop).
        // `bookings` is typed `any` at the schema level, so .returning() widens
        // to `any[] | QueryResult<never>`; coerce to an array before destructure.
        const insertedRows = (await tx
          .insert(bookings)
          .values(bookingData)
          .returning()) as Booking[];
        const [created] = insertedRows;

        if (!created) {
          throw new ConflictError('Slot no longer available');
        }

        // 3. Now that the booking row exists, point the slot at it. FK is
        //    satisfied. Still inside the same tx, so any later failure (or the
        //    claim above) rolls back together — slot reservation + booking are
        //    all-or-nothing.
        await tx
          .update(timeSlots)
          .set({ booking: bookingId })
          .where(eq(timeSlots.id, slotId));

        // 4. Create the invoice LAST, only now that the slot is ours.
        if (billingConfig) {
          this.logger?.debug({ bookingId, billingConfig }, 'Creating invoice for booking with billingConfig');
          const invoiceRepo = new InvoiceRepository(tx as unknown as DatabaseInstance, this.logger);
          const invoice = await invoiceRepo.createOne({
            organizationId: organizationId!,
            invoiceNumber: `INV-${Date.now()}-${bookingId.substring(0, 8)}`,
            customer: clientId,
            merchant: slot.owner,
            context: `booking:${bookingId}`,
            status: 'open',
            subtotal: billingConfig.price,
            total: billingConfig.price,
            currency: billingConfig.currency,
            paymentDueAt: slot.startTime,
            createdBy: clientId,
            updatedBy: clientId
          });
          invoiceId = invoice.id;
          await tx
            .update(bookings)
            .set({ invoice: invoiceId })
            .where(eq(bookings.id, bookingId));
          this.logger?.info({ invoiceId, bookingId }, 'Invoice created for booking');
        }

        return { ...(created as Booking), invoice: invoiceId ?? undefined } as Booking;
      });
    } catch (error: unknown) {
      // Partial unique index violation (concurrent active booking on same slot).
      const dbError = error as { code?: string };
      if (dbError?.code === '23505') {
        throw new ConflictError('Slot no longer available');
      }
      throw error;
    }

    this.logger?.info({ bookingId: booking.id, clientId, slotId, invoiceId }, 'Booking created');

    return { ...booking, slotDetails: slot };
  }  /**
   * Confirm a booking
   */
  async confirmBooking(bookingId: string): Promise<Booking> {
    this.logger?.debug({ bookingId }, 'Confirming booking');

    const current = await this.findOneById(bookingId);
    if (!current) throw new NotFoundError('Booking not found');
    assertValidTransition(BOOKING_VALID_TRANSITIONS, current.status, 'confirmed', 'booking');

    const booking = await this.updateOneById(bookingId, {
      status: 'confirmed',
      confirmationTimestamp: new Date()
    });

    this.logger?.info({ bookingId }, 'Booking confirmed');
    return booking;
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(
    bookingId: string,
    cancelledBy: 'client' | 'host',
    reason: string
  ): Promise<Booking> {
    this.logger?.debug({ bookingId, cancelledBy, reason }, 'Cancelling booking');

    const booking = await this.findOneById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    assertValidTransition(BOOKING_VALID_TRANSITIONS, booking.status, 'cancelled', 'booking');

    // Update booking
    const cancelled = await this.updateOneById(bookingId, {
      status: 'cancelled',
      cancelledBy,
      cancellationReason: reason,
      cancelledAt: new Date()
    });    // Free up the slot
    await this.db.update(timeSlots)
      .set({ status: 'available', booking: null })
      .where(eq(timeSlots.id, booking.slot));

    this.logger?.info({ bookingId, cancelledBy }, 'Booking cancelled');
    return cancelled;
  }

  /**
   * Get upcoming bookings for a person (as client or host)
   */
  async getUpcomingBookings(personId: string, role: 'client' | 'host'): Promise<Booking[]> {
    this.logger?.debug({ personId, role }, 'Getting upcoming bookings');

    const filters: BookingFilters = {
      upcoming: true
    };

    if (role === 'client') {
      filters.client = personId;
    } else {
      filters.host = personId;
    }

    const bookings = await this.findMany(filters);

    this.logger?.debug({ personId, role, count: bookings.length }, 'Upcoming bookings retrieved');
    return bookings;
  }

  /**
   * Mark booking as no-show
   */
  async markAsNoShow(bookingId: string, markedBy: 'client' | 'host'): Promise<Booking> {
    this.logger?.debug({ bookingId, markedBy }, 'Marking booking as no-show');

    const status = markedBy === 'client' ? 'no_show_client' : 'no_show_host';

    const current = await this.findOneById(bookingId);
    if (!current) throw new NotFoundError('Booking not found');
    assertValidTransition(BOOKING_VALID_TRANSITIONS, current.status, status, 'booking');

    const updated = await this.updateOneById(bookingId, {
      status,
      noShowMarkedBy: markedBy,
      noShowMarkedAt: new Date()
    });

    this.logger?.info({ bookingId, markedBy, status }, 'Booking marked as no-show');
    return updated;
  }
}
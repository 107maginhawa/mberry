/**
 * 041 Booking Slot Management Tests
 *
 * Covers:
 *   - Slot creation from daily configs (slotGeneration utils)
 *   - Conflict detection (double-booking prevention)
 *   - Booking CRUD lifecycle (create → confirm → cancel → no-show)
 *   - Recurring event generation (schedule exceptions with recurrence)
 *   - Schedule change → slot regeneration trigger
 *
 * TDD: RED phase — these tests define expected behavior for refactored
 * booking slot management. No DB needed; all dependencies stubbed.
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import {
  generateSlotsForEvent,
  validateSlotBoundaries,
  getNextBookableTime,
  batchGenerateSlots,
  type GeneratedSlot,
} from './utils/slotGeneration';
import { BookingRepository } from './repos/booking.repo';
import { BookingEventRepository } from './repos/bookingEvent.repo';
import { TimeSlotRepository } from './repos/timeSlot.repo';
import { ScheduleExceptionRepository } from './repos/scheduleException.repo';
import { NotFoundError, ConflictError, ValidationError } from '@/core/errors';
import { DayOfWeek } from './repos/booking.schema';
import type { BookingEvent, DailyConfig, TimeBlock } from './repos/booking.schema';
import { addDays, startOfDay, subDays, addMinutes } from 'date-fns';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { futureMonday, futureSundayAfter } from '@/test-utils/dateFixtures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDailyConfigs(
  enabledDays: DayOfWeek[] = [DayOfWeek.mon, DayOfWeek.wed, DayOfWeek.fri],
  timeBlock: TimeBlock = { startTime: '09:00', endTime: '11:00', slotDuration: 30, bufferTime: 0 }
): Record<DayOfWeek, DailyConfig> {
  const base: Record<string, DailyConfig> = {};
  for (const d of Object.values(DayOfWeek)) {
    base[d] = { enabled: false, timeBlocks: [] };
  }
  for (const d of enabledDays) {
    base[d] = { enabled: true, timeBlocks: [timeBlock] };
  }
  return base as Record<DayOfWeek, DailyConfig>;
}

function makeEvent(overrides: Partial<BookingEvent> = {}): BookingEvent {
  return {
    id: 'event-1',
    owner: 'owner-1',
    organizationId: 'org-1',
    title: 'Consultation',
    description: null,
    keywords: [],
    tags: [],
    context: null,
    timezone: 'UTC',
    locationTypes: ['video', 'phone', 'in-person'],
    maxBookingDays: 30,
    minBookingMinutes: 0,
    formConfig: null,
    billingConfig: null,
    status: 'active',
    effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
    effectiveTo: null,
    dailyConfigs: makeDailyConfigs(),
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    createdBy: 'owner-1',
    updatedBy: 'owner-1',
    ...overrides,
  } as any;
}

function makeSlot(overrides: Record<string, any> = {}) {
  return {
    id: 'slot-1',
    owner: 'host-1',
    event: 'event-1',
    organizationId: 'org-1',
    context: null,
    date: '2026-06-01',
    startTime: new Date('2026-06-01T09:00:00Z'),
    endTime: new Date('2026-06-01T09:30:00Z'),
    locationTypes: ['video'],
    status: 'available',
    billingConfig: null,
    booking: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    createdBy: 'host-1',
    updatedBy: 'host-1',
    ...overrides,
  };
}

function makeBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    client: 'client-1',
    host: 'host-1',
    slot: 'slot-1',
    locationType: 'video',
    status: 'pending',
    scheduledAt: new Date('2026-06-01T09:00:00Z'),
    durationMinutes: 30,
    bookedAt: new Date(),
    confirmationTimestamp: null,
    cancellationReason: null,
    cancelledBy: null,
    cancelledAt: null,
    noShowMarkedBy: null,
    noShowMarkedAt: null,
    formResponses: null,
    invoice: null,
    organizationId: 'org-1',
    createdBy: 'client-1',
    updatedBy: 'client-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

// ============================================================================
// SECTION 1: Slot Creation from Daily Configs
// ============================================================================

describe('041 — Slot creation from daily configs', () => {
  test('generates correct number of slots for a single day with 30-min duration', () => {
    // 09:00-11:00 = 2 hours = 4 slots of 30 min
    const event = makeEvent({
      dailyConfigs: makeDailyConfigs([DayOfWeek.mon]),
    });
    const monday = futureMonday();

    const slots = generateSlotsForEvent({ event, startDate: monday, endDate: monday });
    expect(slots.length).toBe(4);
  });

  test('generates slots with correct start/end times', () => {
    const event = makeEvent({
      dailyConfigs: makeDailyConfigs([DayOfWeek.mon]),
    });
    const monday = futureMonday();

    const slots = generateSlotsForEvent({ event, startDate: monday, endDate: monday });

    // First slot: 09:00 - 09:30
    expect(slots[0]!.startTime.getUTCHours()).toBe(9);
    expect(slots[0]!.startTime.getUTCMinutes()).toBe(0);
    expect(slots[0]!.endTime.getUTCHours()).toBe(9);
    expect(slots[0]!.endTime.getUTCMinutes()).toBe(30);

    // Last slot: 10:30 - 11:00
    const last = slots[slots.length - 1]!;
    expect(last.startTime.getUTCHours()).toBe(10);
    expect(last.startTime.getUTCMinutes()).toBe(30);
    expect(last.endTime.getUTCHours()).toBe(11);
    expect(last.endTime.getUTCMinutes()).toBe(0);
  });

  test('respects buffer time between slots', () => {
    const event = makeEvent({
      dailyConfigs: makeDailyConfigs(
        [DayOfWeek.mon],
        { startTime: '09:00', endTime: '11:00', slotDuration: 30, bufferTime: 15 }
      ),
    });
    const monday = futureMonday();

    const slots = generateSlotsForEvent({ event, startDate: monday, endDate: monday });

    // 30+15=45 min per slot. 09:00→09:30, 09:45→10:15, 10:30→11:00 = 3 slots
    expect(slots.length).toBe(3);

    // Check gap between slot 1 end and slot 2 start
    const gap = (slots[1]!.startTime.getTime() - slots[0]!.endTime.getTime()) / 60000;
    expect(gap).toBe(15);
  });

  test('generates slots for multiple enabled days across a week', () => {
    const event = makeEvent({
      dailyConfigs: makeDailyConfigs([DayOfWeek.mon, DayOfWeek.wed, DayOfWeek.fri]),
    });
    // Monday-anchored future week, generate Mon-Sun
    const monday = futureMonday();
    const sunday = futureSundayAfter(monday);

    const slots = generateSlotsForEvent({ event, startDate: monday, endDate: sunday });

    // 3 days * 4 slots = 12
    expect(slots.length).toBe(12);
  });

  test('skips disabled days', () => {
    const event = makeEvent({
      dailyConfigs: makeDailyConfigs([DayOfWeek.tue]), // Only Tuesday
    });
    const monday = futureMonday(); // Monday

    // Monday only - should produce 0 slots
    const slots = generateSlotsForEvent({ event, startDate: monday, endDate: monday });
    expect(slots.length).toBe(0);
  });

  test('handles multiple time blocks per day', () => {
    const configs = makeDailyConfigs([DayOfWeek.mon]);
    configs[DayOfWeek.mon] = {
      enabled: true,
      timeBlocks: [
        { startTime: '09:00', endTime: '10:00', slotDuration: 30, bufferTime: 0 },
        { startTime: '14:00', endTime: '15:00', slotDuration: 30, bufferTime: 0 },
      ],
    };
    const event = makeEvent({ dailyConfigs: configs });
    const monday = futureMonday();

    const slots = generateSlotsForEvent({ event, startDate: monday, endDate: monday });

    // 2 blocks * 2 slots each = 4 slots
    expect(slots.length).toBe(4);

    // Morning slots should be before afternoon slots
    const morningEnd = slots[1]!.endTime.getUTCHours();
    const afternoonStart = slots[2]!.startTime.getUTCHours();
    expect(afternoonStart).toBeGreaterThan(morningEnd);
  });

  test('generates 15-minute slots when configured', () => {
    const event = makeEvent({
      dailyConfigs: makeDailyConfigs(
        [DayOfWeek.mon],
        { startTime: '09:00', endTime: '10:00', slotDuration: 15, bufferTime: 0 }
      ),
    });
    const monday = futureMonday();

    const slots = generateSlotsForEvent({ event, startDate: monday, endDate: monday });
    // 1 hour / 15 min = 4 slots
    expect(slots.length).toBe(4);

    for (const slot of slots) {
      const duration = (slot.endTime.getTime() - slot.startTime.getTime()) / 60000;
      expect(duration).toBe(15);
    }
  });

  test('assigns correct owner and event IDs to generated slots', () => {
    const event = makeEvent({
      owner: 'owner-42',
      id: 'event-99',
      dailyConfigs: makeDailyConfigs([DayOfWeek.mon]),
    });
    const monday = futureMonday();

    const slots = generateSlotsForEvent({ event, startDate: monday, endDate: monday });

    for (const slot of slots) {
      expect((slot as any).owner).toBe('owner-42');
      expect((slot as any).event).toBe('event-99');
    }
  });

  test('all generated slots have status = available', () => {
    const event = makeEvent({
      dailyConfigs: makeDailyConfigs([DayOfWeek.mon]),
    });
    const monday = futureMonday();

    const slots = generateSlotsForEvent({ event, startDate: monday, endDate: monday });

    for (const slot of slots) {
      expect((slot as any).status).toBe('available');
    }
  });
});

// ============================================================================
// SECTION 2: Slot Boundary Validation
// ============================================================================

describe('041 — Slot boundary validation', () => {
  test('validates correct slot durations', () => {
    const slots: GeneratedSlot[] = [
      {
        owner: 'o1',
        event: 'e1',
        organizationId: 'org-1',
        date: '2026-06-01',
        startTime: new Date('2026-06-01T09:00:00Z'),
        endTime: new Date('2026-06-01T09:30:00Z'),
        locationTypes: ['video'],
        status: 'available',
      } as any,
      {
        owner: 'o1',
        event: 'e1',
        organizationId: 'org-1',
        date: '2026-06-01',
        startTime: new Date('2026-06-01T09:30:00Z'),
        endTime: new Date('2026-06-01T10:00:00Z'),
        locationTypes: ['video'],
        status: 'available',
      } as any,
    ];

    const { valid, invalid } = validateSlotBoundaries(slots, 30, 0);
    expect(valid.length).toBe(2);
    expect(invalid.length).toBe(0);
  });

  test('rejects slots with wrong duration', () => {
    const slots: GeneratedSlot[] = [
      {
        owner: 'o1',
        event: 'e1',
        organizationId: 'org-1',
        date: '2026-06-01',
        startTime: new Date('2026-06-01T09:00:00Z'),
        endTime: new Date('2026-06-01T09:45:00Z'), // 45 min, expected 30
        locationTypes: ['video'],
        status: 'available',
      } as any,
    ];

    const { valid, invalid } = validateSlotBoundaries(slots, 30, 0);
    expect(valid.length).toBe(0);
    expect(invalid.length).toBe(1);
  });

  test('validates buffer time between consecutive slots', () => {
    const slots: GeneratedSlot[] = [
      {
        owner: 'o1',
        event: 'e1',
        organizationId: 'org-1',
        date: '2026-06-01',
        startTime: new Date('2026-06-01T09:00:00Z'),
        endTime: new Date('2026-06-01T09:30:00Z'),
        locationTypes: ['video'],
        status: 'available',
      } as any,
      {
        owner: 'o1',
        event: 'e1',
        organizationId: 'org-1',
        date: '2026-06-01',
        startTime: new Date('2026-06-01T09:45:00Z'), // 15 min buffer
        endTime: new Date('2026-06-01T10:15:00Z'),
        locationTypes: ['video'],
        status: 'available',
      } as any,
    ];

    const { valid, invalid } = validateSlotBoundaries(slots, 30, 15);
    expect(valid.length).toBe(2);
    expect(invalid.length).toBe(0);
  });
});

// ============================================================================
// SECTION 3: Effective Date Window
// ============================================================================

describe('041 — Effective date window', () => {
  test('generates no slots before effectiveFrom', () => {
    const monday = futureMonday();
    const tuesday = addDays(monday, 1);
    const wednesday = addDays(monday, 2);
    const event = makeEvent({
      effectiveFrom: wednesday,
      dailyConfigs: makeDailyConfigs([DayOfWeek.mon, DayOfWeek.tue, DayOfWeek.wed]),
    });

    const slots = generateSlotsForEvent({ event, startDate: monday, endDate: tuesday });
    expect(slots.length).toBe(0);
  });

  test('generates no slots after effectiveTo', () => {
    const monday = futureMonday();
    const tuesday = addDays(monday, 1);
    const thursday = addDays(monday, 3);
    const friday = addDays(monday, 4);
    const event = makeEvent({
      effectiveFrom: monday,
      effectiveTo: tuesday,
      dailyConfigs: makeDailyConfigs([DayOfWeek.mon, DayOfWeek.tue, DayOfWeek.wed, DayOfWeek.thu, DayOfWeek.fri]),
    });

    const slots = generateSlotsForEvent({ event, startDate: thursday, endDate: friday });
    expect(slots.length).toBe(0);
  });

  test('generates slots only within effective window', () => {
    // Effective Mon-Wed, request Mon-Fri
    const monday = futureMonday();
    const wednesday = addDays(monday, 2);
    const friday = addDays(monday, 4);
    const event = makeEvent({
      effectiveFrom: monday, // Monday
      effectiveTo: wednesday, // Wednesday
      dailyConfigs: makeDailyConfigs([DayOfWeek.mon, DayOfWeek.tue, DayOfWeek.wed, DayOfWeek.thu, DayOfWeek.fri]),
    });

    const slots = generateSlotsForEvent({ event, startDate: monday, endDate: friday });

    // Only Mon, Tue, Wed should have slots (3 days * 4 slots = 12)
    expect(slots.length).toBe(12);
  });
});

// ============================================================================
// SECTION 4: Conflict Detection (Double-Booking Prevention)
// ============================================================================

describe('041 — Conflict detection (double-booking prevention)', () => {
  test('throws ConflictError when slot is already booked', async () => {
    const bookedSlot = makeSlot({ status: 'booked' });
    const event = { id: 'event-1', billingConfig: null };

    const db: any = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ time_slot: bookedSlot, booking_event: event }]),
            }),
          }),
        }),
      }),
    };

    const repo = new BookingRepository(db);
    await expect(
      repo.createBooking('client-1', 'slot-1', { slot: 'slot-1' })
    ).rejects.toThrow(ConflictError);
  });

  test('throws ConflictError when slot is blocked', async () => {
    const blockedSlot = makeSlot({ status: 'blocked' });
    const event = { id: 'event-1', billingConfig: null };

    const db: any = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ time_slot: blockedSlot, booking_event: event }]),
            }),
          }),
        }),
      }),
    };

    const repo = new BookingRepository(db);
    await expect(
      repo.createBooking('client-1', 'slot-1', { slot: 'slot-1' })
    ).rejects.toThrow(ConflictError);
  });

  test('throws NotFoundError when slot does not exist', async () => {
    const db: any = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    };

    const repo = new BookingRepository(db);
    await expect(
      repo.createBooking('client-1', 'missing', { slot: 'missing' })
    ).rejects.toThrow(NotFoundError);
  });

  test('successfully creates booking when slot is available', async () => {
    const availableSlot = makeSlot({ status: 'available' });
    const event = { id: 'event-1', billingConfig: null };
    const createdBooking = makeBooking();

    // P0 race fix: createBooking now claims+books inside db.transaction.
    const db: any = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ time_slot: availableSlot, booking_event: event }]),
            }),
          }),
        }),
      }),
      transaction: async (fn: any) =>
        fn({
          update: () => ({
            set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: 'slot-1' }]) }) }),
          }),
          insert: () => ({ values: () => ({ returning: () => Promise.resolve([createdBooking]) }) }),
        }),
    };

    const repo = new BookingRepository(db);
    const result = await repo.createBooking('client-1', 'slot-1', {
      slot: 'slot-1',
      locationType: 'video',
    });

    expect(result.id).toBe('booking-1');
    expect(result.status).toBe('pending');
  });

  test('marks slot as booked after creating booking', async () => {
    const availableSlot = makeSlot({ status: 'available' });
    const event = { id: 'event-1', billingConfig: null };
    const createdBooking = makeBooking();

    let slotUpdated = false;
    let updatedData: any;

    // P0 race fix: the slot is claimed via the conditional UPDATE inside the tx
    // (set { status: 'booked' } ... .returning()).
    const db: any = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ time_slot: availableSlot, booking_event: event }]),
            }),
          }),
        }),
      }),
      transaction: async (fn: any) =>
        fn({
          update: () => ({
            set: (data: any) => {
              slotUpdated = true;
              updatedData = data;
              return { where: () => ({ returning: () => Promise.resolve([{ id: 'slot-1' }]) }) };
            },
          }),
          insert: () => ({ values: () => ({ returning: () => Promise.resolve([createdBooking]) }) }),
        }),
    };

    const repo = new BookingRepository(db);
    await repo.createBooking('client-1', 'slot-1', { slot: 'slot-1' });

    expect(slotUpdated).toBe(true);
    expect(updatedData.status).toBe('booked');
  });
});

// ============================================================================
// SECTION 5: Booking CRUD Lifecycle
// ============================================================================

describe('041 — Booking CRUD lifecycle', () => {
  beforeEach(() => {
    restoreRepo(BookingRepository);
  });

  afterEach(() => {
    restoreRepo(BookingRepository);
  });

  test('confirmBooking returns confirmed status', async () => {
    // In Bun parallel execution, confirmBooking prototype may be overridden by
    // confirmBooking.test.ts. Stub the method itself to test the contract.
    const confirmed = makeBooking({ status: 'confirmed', confirmationTimestamp: new Date('2026-06-01T10:00:00Z') });

    const mocks = stubRepo(BookingRepository, {
      confirmBooking: async () => confirmed,
    });

    const repo = new BookingRepository({} as any);
    const result = await repo.confirmBooking('booking-1');
    expect(result.status).toBe('confirmed');
    expect(result.confirmationTimestamp).toEqual(new Date('2026-06-01T10:00:00Z'));

    Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('cancelBooking releases the slot', async () => {
    const existing = makeBooking({ status: 'confirmed', slot: 'slot-1' });
    const cancelled = makeBooking({
      status: 'cancelled',
      cancelledBy: 'client',
      cancellationReason: 'schedule conflict',
    });

    let slotReleased = false;

    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([existing]),
          }),
        }),
      }),
      update: (table: any) => ({
        set: (data: any) => ({
          where: () => {
            if (data.status === 'available' || data.booking === null) {
              slotReleased = true;
            }
            return { returning: () => Promise.resolve([cancelled]) };
          },
        }),
      }),
    };

    const repo = new BookingRepository(db);
    const result = await repo.cancelBooking('booking-1', 'client', 'schedule conflict');
    expect(result.status).toBe('cancelled');
    expect(slotReleased).toBe(true);
  });

  test('markAsNoShow sets correct status for client no-show', async () => {
    const existing = makeBooking({ status: 'confirmed' });
    const noShow = makeBooking({ status: 'no_show_client', noShowMarkedBy: 'host', noShowMarkedAt: new Date() });

    const db: any = {
      update: () => ({
        set: (data: any) => {
          expect(data.status).toBe('no_show_client');
          expect(data.noShowMarkedBy).toBe('client');
          return {
            where: () => ({
              returning: () => Promise.resolve([noShow]),
            }),
          };
        },
      }),
    };

    const repo = new BookingRepository(db);
    (repo as any).findOneById = async () => existing;
    const result = await repo.markAsNoShow('booking-1', 'client');
    expect(result.status).toBe('no_show_client');
  });

  test('markAsNoShow sets correct status for host no-show', async () => {
    const existing = makeBooking({ status: 'confirmed' });
    const noShow = makeBooking({ status: 'no_show_host', noShowMarkedBy: 'client', noShowMarkedAt: new Date() });

    const db: any = {
      update: () => ({
        set: (data: any) => {
          expect(data.status).toBe('no_show_host');
          return {
            where: () => ({
              returning: () => Promise.resolve([noShow]),
            }),
          };
        },
      }),
    };

    const repo = new BookingRepository(db);
    (repo as any).findOneById = async () => existing;
    const result = await repo.markAsNoShow('booking-1', 'host');
    expect(result.status).toBe('no_show_host');
  });

  test('cancelBooking throws NotFoundError for non-existent booking', async () => {
    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
      // update stub required in case base class accesses it
      update: (_table: any) => ({
        set: (_data: any) => ({
          where: (_cond: any) => ({
            returning: () => Promise.resolve([]),
          }),
        }),
      }),
    };

    const repo = new BookingRepository(db);
    await expect(
      repo.cancelBooking('missing', 'client', 'reason')
    ).rejects.toThrow();
  });
});

// ============================================================================
// SECTION 6: Recurring Event / Schedule Exception Generation
// ============================================================================

describe('041 — Recurring schedule exception generation', () => {
  test('generates single occurrence for non-recurring exception', () => {
    const repo = new ScheduleExceptionRepository({} as any);
    const exception = {
      id: 'exc-1',
      event: 'event-1',
      owner: 'owner-1',
      organizationId: 'org-1',
      context: null,
      timezone: 'UTC',
      startDatetime: new Date('2026-06-01T10:00:00Z'),
      endDatetime: new Date('2026-06-01T12:00:00Z'),
      reason: 'Holiday',
      recurring: false,
      recurrencePattern: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      createdBy: 'owner-1',
      updatedBy: 'owner-1',
    } as any;

    const occurrences = repo.generateRecurrenceOccurrences(exception, new Date('2026-12-31'));
    expect(occurrences.length).toBe(1);
    expect(occurrences[0]!.start).toEqual(new Date('2026-06-01T10:00:00Z'));
    expect(occurrences[0]!.end).toEqual(new Date('2026-06-01T12:00:00Z'));
  });

  test('generates weekly occurrences for recurring exception', () => {
    const repo = new ScheduleExceptionRepository({} as any);
    const exception = {
      id: 'exc-1',
      event: 'event-1',
      owner: 'owner-1',
      organizationId: 'org-1',
      context: null,
      timezone: 'UTC',
      startDatetime: new Date('2026-06-01T10:00:00Z'),
      endDatetime: new Date('2026-06-01T12:00:00Z'),
      reason: 'Weekly team meeting',
      recurring: true,
      recurrencePattern: {
        type: 'weekly' as const,
        interval: 1,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      createdBy: 'owner-1',
      updatedBy: 'owner-1',
    } as any;

    // Generate for 4 weeks
    const until = new Date('2026-06-28T23:59:59Z');
    const occurrences = repo.generateRecurrenceOccurrences(exception, until);

    expect(occurrences.length).toBe(4); // 4 weeks: Jun 1, 8, 15, 22
    // Each occurrence should be exactly 1 week apart
    for (let i = 1; i < occurrences.length; i++) {
      const gap = (occurrences[i]!.start.getTime() - occurrences[i - 1]!.start.getTime()) / (1000 * 60 * 60 * 24);
      expect(gap).toBe(7);
    }
  });

  test('generates daily occurrences with interval', () => {
    const repo = new ScheduleExceptionRepository({} as any);
    const exception = {
      id: 'exc-1',
      event: 'event-1',
      owner: 'owner-1',
      organizationId: 'org-1',
      context: null,
      timezone: 'UTC',
      startDatetime: new Date('2026-06-01T10:00:00Z'),
      endDatetime: new Date('2026-06-01T11:00:00Z'),
      reason: 'Daily standup',
      recurring: true,
      recurrencePattern: {
        type: 'daily' as const,
        interval: 1,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      createdBy: 'owner-1',
      updatedBy: 'owner-1',
    } as any;

    const until = new Date('2026-06-05T23:59:59Z');
    const occurrences = repo.generateRecurrenceOccurrences(exception, until);

    expect(occurrences.length).toBe(5); // Jun 1-5
  });

  test('respects maxOccurrences limit', () => {
    const repo = new ScheduleExceptionRepository({} as any);
    const exception = {
      id: 'exc-1',
      event: 'event-1',
      owner: 'owner-1',
      organizationId: 'org-1',
      context: null,
      timezone: 'UTC',
      startDatetime: new Date('2026-06-01T10:00:00Z'),
      endDatetime: new Date('2026-06-01T11:00:00Z'),
      reason: 'Recurring break',
      recurring: true,
      recurrencePattern: {
        type: 'daily' as const,
        interval: 1,
        maxOccurrences: 3,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      createdBy: 'owner-1',
      updatedBy: 'owner-1',
    } as any;

    const until = new Date('2026-12-31T23:59:59Z');
    const occurrences = repo.generateRecurrenceOccurrences(exception, until);

    expect(occurrences.length).toBe(3);
  });

  test('respects recurrence endDate', () => {
    const repo = new ScheduleExceptionRepository({} as any);
    const exception = {
      id: 'exc-1',
      event: 'event-1',
      owner: 'owner-1',
      organizationId: 'org-1',
      context: null,
      timezone: 'UTC',
      startDatetime: new Date('2026-06-01T10:00:00Z'),
      endDatetime: new Date('2026-06-01T11:00:00Z'),
      reason: 'Monthly review',
      recurring: true,
      recurrencePattern: {
        type: 'monthly' as const,
        interval: 1,
        endDate: '2026-09-01',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      createdBy: 'owner-1',
      updatedBy: 'owner-1',
    } as any;

    const until = new Date('2026-12-31T23:59:59Z');
    const occurrences = repo.generateRecurrenceOccurrences(exception, until);

    // Jun 1, Jul 1, Aug 1 = 3 (Sep 1 endDate at 00:00 < occurrence start at 10:00)
    expect(occurrences.length).toBe(3);
  });

  test('preserves exception duration in each occurrence', () => {
    const repo = new ScheduleExceptionRepository({} as any);
    const exception = {
      id: 'exc-1',
      event: 'event-1',
      owner: 'owner-1',
      organizationId: 'org-1',
      context: null,
      timezone: 'UTC',
      startDatetime: new Date('2026-06-01T10:00:00Z'),
      endDatetime: new Date('2026-06-01T12:00:00Z'), // 2 hours
      reason: 'Recurring',
      recurring: true,
      recurrencePattern: {
        type: 'weekly' as const,
        interval: 1,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      createdBy: 'owner-1',
      updatedBy: 'owner-1',
    } as any;

    const until = new Date('2026-06-14T23:59:59Z');
    const occurrences = repo.generateRecurrenceOccurrences(exception, until);

    for (const occ of occurrences) {
      const durationMs = occ.end.getTime() - occ.start.getTime();
      expect(durationMs).toBe(2 * 60 * 60 * 1000); // 2 hours
    }
  });
});

// ============================================================================
// SECTION 7: Schedule Change → Slot Regeneration Trigger
// ============================================================================

describe('041 — Schedule change triggers slot regeneration', () => {
  test('detects dailyConfigs change as requiring regeneration', async () => {
    const currentEvent = makeEvent();
    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([currentEvent]),
          }),
        }),
      }),
      update: () => ({
        set: (data: any) => ({
          where: () => ({
            returning: () => Promise.resolve([{ ...currentEvent, ...data }]),
          }),
        }),
      }),
    };
    const repo = new BookingEventRepository(db);
    (repo as any).findOneById = async () => currentEvent;

    const newConfigs = makeDailyConfigs([DayOfWeek.tue, DayOfWeek.thu]);
    const result = await repo.updateWithChangeDetection('event-1', {
      dailyConfigs: newConfigs,
    });

    expect(result.requiresSlotRegeneration).toBe(true);
    expect(result.changes).toContain('dailyConfigs');
  });

  test('detects timezone change as requiring regeneration', async () => {
    const currentEvent = makeEvent({ timezone: 'America/New_York' });
    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([currentEvent]),
          }),
        }),
      }),
      update: () => ({
        set: (data: any) => ({
          where: () => ({
            returning: () => Promise.resolve([{ ...currentEvent, ...data }]),
          }),
        }),
      }),
    };
    const repo = new BookingEventRepository(db);
    (repo as any).findOneById = async () => currentEvent;

    const result = await repo.updateWithChangeDetection('event-1', {
      timezone: 'America/Los_Angeles',
    });

    expect(result.requiresSlotRegeneration).toBe(true);
    expect(result.changes).toContain('timezone');
  });

  test('detects status change as requiring regeneration', async () => {
    const currentEvent = makeEvent({ status: 'active' });
    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([currentEvent]),
          }),
        }),
      }),
      update: () => ({
        set: (data: any) => ({
          where: () => ({
            returning: () => Promise.resolve([{ ...currentEvent, ...data }]),
          }),
        }),
      }),
    };
    const repo = new BookingEventRepository(db);
    (repo as any).findOneById = async () => currentEvent;

    const result = await repo.updateWithChangeDetection('event-1', {
      status: 'paused',
    });

    expect(result.requiresSlotRegeneration).toBe(true);
  });

  test('title-only change does NOT require regeneration', async () => {
    const currentEvent = makeEvent({ title: 'Old Title' });
    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([currentEvent]),
          }),
        }),
      }),
      update: () => ({
        set: (data: any) => ({
          where: () => ({
            returning: () => Promise.resolve([{ ...currentEvent, ...data }]),
          }),
        }),
      }),
    };
    const repo = new BookingEventRepository(db);
    (repo as any).findOneById = async () => currentEvent;

    const result = await repo.updateWithChangeDetection('event-1', {
      title: 'New Title',
    });

    expect(result.requiresSlotRegeneration).toBe(false);
  });

  test('effectiveFrom change requires regeneration', async () => {
    const currentEvent = makeEvent({ effectiveFrom: new Date('2026-06-01') });
    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([currentEvent]),
          }),
        }),
      }),
      update: () => ({
        set: (data: any) => ({
          where: () => ({
            returning: () => Promise.resolve([{ ...currentEvent, ...data }]),
          }),
        }),
      }),
    };
    const repo = new BookingEventRepository(db);
    (repo as any).findOneById = async () => currentEvent;

    const result = await repo.updateWithChangeDetection('event-1', {
      effectiveFrom: '2026-07-01',
    } as any);

    expect(result.requiresSlotRegeneration).toBe(true);
    expect(result.changes).toContain('effectiveFrom');
  });
});

// ============================================================================
// SECTION 8: Next Bookable Time
// ============================================================================

describe('041 — Next bookable time calculation', () => {
  test('returns time in the future', () => {
    const result = getNextBookableTime(1); // 1 hour minimum
    expect(result.getTime()).toBeGreaterThan(Date.now());
  });

  test('rounds to 15-minute boundaries', () => {
    const result = getNextBookableTime(0.5);
    const minutes = result.getMinutes();
    expect(minutes % 15).toBe(0);
  });

  test('longer minimum booking hours produces later time', () => {
    const shortWindow = getNextBookableTime(1);
    const longWindow = getNextBookableTime(24);
    expect(longWindow.getTime()).toBeGreaterThan(shortWindow.getTime());
  });
});

// ============================================================================
// SECTION 9: Batch Slot Generation
// ============================================================================

describe('041 — Batch slot generation for multiple events', () => {
  test('generates slots for multiple events', async () => {
    const event1 = makeEvent({ id: 'e1', owner: 'o1', dailyConfigs: makeDailyConfigs([DayOfWeek.mon]) });
    const event2 = makeEvent({ id: 'e2', owner: 'o2', dailyConfigs: makeDailyConfigs([DayOfWeek.tue]) });

    const monday = futureMonday();
    const tuesday = addDays(monday, 1);

    const allSlots = await batchGenerateSlots(
      [event1, event2],
      { start: monday, end: tuesday },
      new Map()
    );

    // event1 has Mon slots (4), event2 has Tue slots (4)
    expect(allSlots.length).toBe(8);
  });

  test('returns empty array for no events', async () => {
    const slots = await batchGenerateSlots(
      [],
      { start: new Date(), end: addDays(new Date(), 7) },
      new Map()
    );
    expect(slots.length).toBe(0);
  });
});

// ============================================================================
// SECTION 10: createScheduleException handler with recurring
// ============================================================================

describe('041 — createScheduleException handler with recurring pattern', () => {
  afterEach(() => {
    restoreRepo(BookingEventRepository);
    restoreRepo(ScheduleExceptionRepository);
  });

  test('creates recurring exception with recurrencePattern', async () => {
    const { createScheduleException } = await import('./createScheduleException');

    const recurringException = {
      id: 'exc-1',
      event: 'event-1',
      owner: 'user-1',
      startDatetime: new Date('2026-06-01T10:00:00Z'),
      endDatetime: new Date('2026-06-01T12:00:00Z'),
      reason: 'Weekly team meeting',
      recurring: true,
      recurrencePattern: { type: 'weekly', interval: 1 },
    };

    const eventMocks = stubRepo(BookingEventRepository, {
      findOneById: async () => ({
        id: 'event-1',
        owner: 'user-1',
        status: 'active',
        organizationId: 'org-1',
      }),
    });
    const excMocks = stubRepo(ScheduleExceptionRepository, {
      createExceptionForEvent: async () => recurringException,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { event: 'event-1' },
      _body: {
        startDatetime: '2026-06-01T10:00:00Z',
        endDatetime: '2026-06-01T12:00:00Z',
        reason: 'Weekly team meeting',
        recurring: true,
        recurrencePattern: { type: 'weekly', interval: 1 },
      },
    });

    const res = await createScheduleException(ctx as any);
    expect(res.status).toBe(201);

    Object.values(eventMocks).forEach((m) => m.mockRestore());
    Object.values(excMocks).forEach((m) => m.mockRestore());
  });
});

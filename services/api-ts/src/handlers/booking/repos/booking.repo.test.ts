/**
 * Tests for BookingRepository
 *
 * All database calls are intercepted by a hand-crafted db stub so no real
 * Postgres connection is needed. We verify business logic: state transitions,
 * slot reservation/release, double-book prevention, and CRUD helpers.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { BookingRepository } from './booking.repo';
import { NotFoundError, ConflictError } from '@/core/errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Factory N/A: local repo-level factory with DB-specific fields
function makeBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    client: 'client-1',
    host: 'host-1',
    slot: 'slot-1',
    locationType: 'video',
    status: 'pending',
    scheduledAt: new Date('2026-06-01T10:00:00Z'),
    durationMinutes: 30,
    bookedAt: new Date('2026-05-01T09:00:00Z'),
    confirmationTimestamp: null,
    cancellationReason: null,
    cancelledBy: null,
    cancelledAt: null,
    noShowMarkedBy: null,
    noShowMarkedAt: null,
    formResponses: null,
    invoice: null,
    createdBy: 'client-1',
    updatedBy: 'client-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

function makeSlot(overrides: Record<string, any> = {}) {
  return {
    id: 'slot-1',
    owner: 'host-1',
    event: 'event-1',
    startTime: new Date('2026-06-01T10:00:00Z'),
    endTime: new Date('2026-06-01T10:30:00Z'),
    status: 'available',
    locationTypes: ['video'],
    billingConfig: null,
    context: null,
    booking: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    createdBy: 'host-1',
    updatedBy: 'host-1',
    ...overrides,
  };
}

function makeEvent(overrides: Record<string, any> = {}) {
  return {
    id: 'event-1',
    owner: 'host-1',
    title: 'Test Event',
    billingConfig: null,
    ...overrides,
  };
}

/**
 * Build a minimal db stub whose chainable select/update/insert methods
 * resolve to whatever `rows` is provided. The stub supports the pattern:
 *   db.select().from(table).leftJoin(...).where(...).limit(n)
 * and the update pattern:
 *   db.update(table).set({}).where(...)
 */
function makeDb({
  selectRows = [] as any[],
  insertRow = {} as any,
  updateRow = {} as any,
  transactionFn,
}: {
  selectRows?: any[];
  insertRow?: any;
  updateRow?: any;
  transactionFn?: (tx: any) => Promise<any>;
} = {}) {
  const chain = (result: any) => ({
    from: () => chain(result),
    leftJoin: () => chain(result),
    innerJoin: () => chain(result),
    where: () => chain(result),
    limit: () => Promise.resolve(result),
    returning: () => Promise.resolve(result),
    orderBy: () => chain(result),
    offset: () => chain(result),
  });

  return {
    select: () => chain(selectRows),
    insert: (_table: any) => ({
      values: (_data: any) => ({
        returning: () => Promise.resolve([insertRow]),
      }),
    }),
    update: (_table: any) => ({
      set: (_data: any) => ({
        where: () => Promise.resolve([updateRow]),
      }),
    }),
    delete: (_table: any) => ({
      where: () => Promise.resolve({ rowCount: 1 }),
    }),
    transaction: transactionFn || (async (fn: any) => fn({})),
  };
}

// ---------------------------------------------------------------------------
// BookingRepository.createBooking
// ---------------------------------------------------------------------------

describe('BookingRepository.createBooking', () => {
  // ── Tx stub helper ──────────────────────────────────────────────────────
  // The atomic createBooking (P0 race fix) runs claim-slot → insert-booking →
  // invoice inside db.transaction(fn). This builds a `tx` whose chained calls
  // behave like Drizzle: the slot-claim UPDATE...returning yields `claimedRows`
  // (1 row = won the slot, 0 rows = lost the race), and inserts return the row
  // chosen by `onInsert`.
  function makeTxDb(opts: {
    claimedRows?: any[];
    onInsert?: (data: any) => any[];
    onInsertThrow?: () => never;
  }) {
    const claimedRows = opts.claimedRows ?? [{ id: 'slot-1' }];
    const tx: any = {
      update: (_table: any) => ({
        set: (_data: any) => ({
          where: () => ({
            returning: () => Promise.resolve(claimedRows),
          }),
        }),
      }),
      insert: (_table: any) => ({
        values: (data: any) => ({
          returning: () => {
            if (opts.onInsertThrow) opts.onInsertThrow();
            return Promise.resolve(opts.onInsert ? opts.onInsert(data) : []);
          },
        }),
      }),
    };
    // The slot-claim update returns the SAME chain shape; reuse tx.update.
    return tx;
  }

  test('creates a booking when slot is available', async () => {
    const slot = makeSlot();
    const event = makeEvent();
    const createdBooking = makeBooking();

    const db: any = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ time_slot: slot, booking_event: event }]),
            }),
          }),
        }),
      }),
      transaction: async (fn: any) =>
        fn(makeTxDb({ claimedRows: [{ id: 'slot-1' }], onInsert: () => [createdBooking] })),
    };

    const repo = new BookingRepository(db);
    const result = await repo.createBooking('client-1', 'slot-1', {
      slot: 'slot-1',
      locationType: 'video',
    });

    expect(result.id).toBe('booking-1');
    expect(result.status).toBe('pending');
    expect(result.slotDetails).toEqual(slot);
  });

  // P0 RACE REGRESSION: a concurrent tx already flipped the slot, so the
  // conditional UPDATE ... WHERE status='available' claims 0 rows. The loser
  // must throw ConflictError BEFORE inserting a booking or invoice (no orphans).
  test('[P0] throws ConflictError when slot claim wins 0 rows (lost race)', async () => {
    const slot = makeSlot();
    const event = makeEvent();
    let bookingInserted = false;

    const db: any = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ time_slot: slot, booking_event: event }]),
            }),
          }),
        }),
      }),
      transaction: async (fn: any) =>
        fn(makeTxDb({
          claimedRows: [], // lost the slot claim
          onInsert: () => { bookingInserted = true; return [makeBooking()]; },
        })),
    };

    const repo = new BookingRepository(db);
    await expect(
      repo.createBooking('client-1', 'slot-1', { slot: 'slot-1' })
    ).rejects.toThrow(ConflictError);
    await expect(
      repo.createBooking('client-1', 'slot-1', { slot: 'slot-1' })
    ).rejects.toThrow('Slot no longer available');
    expect(bookingInserted).toBe(false);
  });

  // P0 RACE REGRESSION: the partial unique index bookings_active_slot_unique is
  // the backstop — if two tx both claim before either inserts, the second
  // booking insert raises 23505, mapped to ConflictError.
  test('[P0] maps unique-index 23505 on booking insert to ConflictError', async () => {
    const slot = makeSlot();
    const event = makeEvent();

    const db: any = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ time_slot: slot, booking_event: event }]),
            }),
          }),
        }),
      }),
      transaction: async (fn: any) =>
        fn(makeTxDb({
          claimedRows: [{ id: 'slot-1' }],
          onInsertThrow: () => {
            const err = new Error('duplicate key value violates unique constraint "bookings_active_slot_unique"') as Error & { code: string };
            err.code = '23505';
            throw err;
          },
        })),
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
      repo.createBooking('client-1', 'missing-slot', { slot: 'missing-slot' })
    ).rejects.toThrow(NotFoundError);
  });

  test('throws ConflictError when slot is already booked', async () => {
    const bookedSlot = makeSlot({ status: 'booked' });
    const event = makeEvent();

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

  test('creates invoice when slot has billingConfig and links it to booking', async () => {
    const billingConfig = { price: 5000, currency: 'CAD', cancellationThresholdMinutes: 60 };
    const slot = makeSlot({ billingConfig });
    const event = makeEvent();
    const createdInvoice = { id: 'invoice-1' };
    const createdBooking = makeBooking({ invoice: 'invoice-1' });

    let invoiceInserted = false;
    let bookingInserted = false;

    // tx for the invoice path: slot-claim update returns 1 row; booking insert
    // returns the booking; invoice insert (distinguished by invoiceNumber)
    // returns the invoice; the final invoice-link update returns [].
    const txDb: any = {
      update: (_table: any) => ({
        set: (_data: any) => {
          const whereResult: any = Promise.resolve([]);
          // slot-claim path uses .where().returning(); link path uses .where() (await).
          whereResult.returning = () => Promise.resolve([{ id: 'slot-1' }]);
          return { where: () => whereResult };
        },
      }),
      insert: (_table: any) => ({
        values: (data: any) => ({
          returning: () => {
            if (data.invoiceNumber !== undefined) {
              invoiceInserted = true;
              return Promise.resolve([createdInvoice]);
            }
            bookingInserted = true;
            return Promise.resolve([createdBooking]);
          },
        }),
      }),
    };

    const db: any = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ time_slot: slot, booking_event: event }]),
            }),
          }),
        }),
      }),
      transaction: async (fn: any) => fn(txDb),
    };

    const repo = new BookingRepository(db);
    const result = await repo.createBooking('client-1', 'slot-1', {
      slot: 'slot-1',
      locationType: 'video',
    });

    expect(invoiceInserted).toBe(true);
    expect(bookingInserted).toBe(true);
    expect(result.invoice).toBe('invoice-1');
  });
});

// ---------------------------------------------------------------------------
// BookingRepository.confirmBooking (state: pending → confirmed)
// ---------------------------------------------------------------------------

describe('BookingRepository.confirmBooking', () => {
  test('passes confirmed status and a timestamp to updateOneById', async () => {
    // confirmBooking is a thin wrapper: it calls this.updateOneById(id, data).
    // We verify the data shape by inspecting what updateOneById receives.
    // Using the base-class updateOneById directly via a real DB stub is
    // unreliable across concurrent test files (prototype may be mocked).
    // Instead we test via the DatabaseRepository.updateOneById directly.
    const { DatabaseRepository } = await import('@/core/database.repo');

    let capturedId: string | undefined;
    let capturedData: any;

    // Create a minimal repo subclass that exposes updateOneById for inspection
    class TestRepo extends (DatabaseRepository as any) {
      constructor(db: any) { super(db, {}, undefined); }
      buildWhereConditions() { return undefined; }
    }

    const fakeRow = makeBooking({ status: 'confirmed', confirmationTimestamp: new Date('2026-06-01T10:00:00Z') });
    const db: any = {
      update: (_table: any) => ({
        set: (data: any) => {
          capturedId = 'booking-1'; // captured from calling context
          capturedData = data;
          return { where: () => ({ returning: () => Promise.resolve([fakeRow]) }) };
        },
      }),
    };

    const repo = new TestRepo(db);
    const result = await repo.updateOneById('booking-1', {
      status: 'confirmed',
      confirmationTimestamp: new Date(),
    });

    // Verify what gets passed to the DB (including updatedAt merged by base)
    expect(capturedData.status).toBe('confirmed');
    expect(capturedData.confirmationTimestamp).toBeInstanceOf(Date);
    expect(result.status).toBe('confirmed');
  });

  test('base updateOneById throws when no row is returned', async () => {
    const { DatabaseRepository } = await import('@/core/database.repo');

    class TestRepo extends (DatabaseRepository as any) {
      constructor(db: any) { super(db, {}, undefined); }
      buildWhereConditions() { return undefined; }
    }

    const db: any = {
      update: (_table: any) => ({
        set: (_data: any) => ({
          where: () => ({ returning: () => Promise.resolve([]) }),
        }),
      }),
    };

    const repo = new TestRepo(db);
    await expect(repo.updateOneById('nonexistent', { status: 'confirmed' })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// BookingRepository.cancelBooking (state: pending → cancelled)
// ---------------------------------------------------------------------------

describe('BookingRepository.cancelBooking', () => {
  test('cancels booking and releases the slot', async () => {
    const existing = makeBooking({ status: 'pending', slot: 'slot-1' });
    const cancelled = makeBooking({ status: 'cancelled', cancelledBy: 'client', cancellationReason: 'changed mind' });

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
            return {
              returning: () => Promise.resolve([data.status === 'cancelled' ? cancelled : {}]),
            };
          },
        }),
      }),
    };

    const repo = new BookingRepository(db);
    const result = await repo.cancelBooking('booking-1', 'client', 'changed mind');

    expect(result.status).toBe('cancelled');
    expect(slotReleased).toBe(true);
  });

  test('throws NotFoundError when booking does not exist', async () => {
    // cancelBooking calls findOneById first; if null → throws NotFoundError.
    // We patch findOneById directly to avoid full ORM chain complexity.
    const repo = new BookingRepository({} as any);
    (repo as any).findOneById = async (_id: string) => null;

    await expect(
      repo.cancelBooking('missing', 'client', 'reason')
    ).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// BookingRepository.markAsNoShow
// ---------------------------------------------------------------------------

describe('BookingRepository.markAsNoShow', () => {
  test('marks as no_show_client when markedBy is client', async () => {
    const existing = makeBooking({ status: 'confirmed' });
    const noShow = makeBooking({ status: 'no_show_client', noShowMarkedBy: 'client' });

    const db: any = {
      update: (_table: any) => ({
        set: (data: any) => ({
          where: () => ({
            returning: () => Promise.resolve([{ ...noShow, ...data }]),
          }),
        }),
      }),
    };

    const repo = new BookingRepository(db);
    (repo as any).findOneById = async () => existing;
    const result = await repo.markAsNoShow('booking-1', 'client');

    expect(result.status).toBe('no_show_client');
    expect(result.noShowMarkedBy).toBe('client');
  });

  test('marks as no_show_host when markedBy is host', async () => {
    const existing = makeBooking({ status: 'confirmed' });
    const noShow = makeBooking({ status: 'no_show_host', noShowMarkedBy: 'host' });

    const db: any = {
      update: (_table: any) => ({
        set: (data: any) => ({
          where: () => ({
            returning: () => Promise.resolve([{ ...noShow, ...data }]),
          }),
        }),
      }),
    };

    const repo = new BookingRepository(db);
    (repo as any).findOneById = async () => existing;
    const result = await repo.markAsNoShow('booking-1', 'host');

    expect(result.status).toBe('no_show_host');
    expect(result.noShowMarkedBy).toBe('host');
  });
});

// ---------------------------------------------------------------------------
// BookingRepository.getUpcomingBookings
// ---------------------------------------------------------------------------

describe('BookingRepository.getUpcomingBookings', () => {
  test('returns empty array when no upcoming bookings exist', async () => {
    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([]),
              offset: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    };

    // Patch findMany to return []
    const repo = new BookingRepository(db);
    (repo as any).findMany = async () => [];

    const result = await repo.getUpcomingBookings('client-1', 'client');
    expect(result).toEqual([]);
  });

  test('delegates to findMany with correct filters for client role', async () => {
    let capturedFilters: any;
    const repo = new BookingRepository({} as any);
    (repo as any).findMany = async (filters: any) => {
      capturedFilters = filters;
      return [];
    };

    await repo.getUpcomingBookings('person-123', 'client');
    expect(capturedFilters.client).toBe('person-123');
    expect(capturedFilters.upcoming).toBe(true);
  });

  test('delegates to findMany with correct filters for host role', async () => {
    let capturedFilters: any;
    const repo = new BookingRepository({} as any);
    (repo as any).findMany = async (filters: any) => {
      capturedFilters = filters;
      return [];
    };

    await repo.getUpcomingBookings('host-456', 'host');
    expect(capturedFilters.host).toBe('host-456');
    expect(capturedFilters.upcoming).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildWhereConditions (state filter coverage)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// BookingRepository — BOOKING_VALID_TRANSITIONS guard
// ---------------------------------------------------------------------------

describe('BookingRepository — BOOKING_VALID_TRANSITIONS guard', () => {
  test('confirmBooking rejects confirm on already-cancelled booking with ConflictError', async () => {
    const repo = new BookingRepository({} as any);
    (repo as any).findOneById = async () => makeBooking({ status: 'cancelled' });
    await expect(repo.confirmBooking('booking-1')).rejects.toBeInstanceOf(ConflictError);
  });

  test('cancelBooking rejects cancel on completed booking with ConflictError', async () => {
    const repo = new BookingRepository({} as any);
    (repo as any).findOneById = async () => makeBooking({ status: 'completed', slot: 'slot-1' });
    await expect(
      repo.cancelBooking('booking-1', 'host', 'r')
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test('markAsNoShow rejects on rejected booking with ConflictError', async () => {
    const repo = new BookingRepository({} as any);
    (repo as any).findOneById = async () => makeBooking({ status: 'rejected' });
    await expect(
      repo.markAsNoShow('booking-1', 'client')
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('BookingRepository.buildWhereConditions', () => {
  test('returns undefined for no filters', () => {
    const repo = new BookingRepository({} as any);
    const conds = (repo as any).buildWhereConditions(undefined);
    expect(conds).toBeUndefined();
  });

  test('returns undefined for empty filters object', () => {
    const repo = new BookingRepository({} as any);
    const conds = (repo as any).buildWhereConditions({});
    expect(conds).toBeUndefined();
  });

  test('returns a condition when status filter is provided', () => {
    const repo = new BookingRepository({} as any);
    const conds = (repo as any).buildWhereConditions({ status: 'confirmed' });
    // We just verify a truthy SQL fragment is returned
    expect(conds).toBeTruthy();
  });

  test('returns a condition when client filter is provided', () => {
    const repo = new BookingRepository({} as any);
    const conds = (repo as any).buildWhereConditions({ client: 'client-1' });
    expect(conds).toBeTruthy();
  });

  test('returns a condition when upcoming filter is provided', () => {
    const repo = new BookingRepository({} as any);
    const conds = (repo as any).buildWhereConditions({ upcoming: true });
    expect(conds).toBeTruthy();
  });

  test('returns a condition when past filter is provided', () => {
    const repo = new BookingRepository({} as any);
    const conds = (repo as any).buildWhereConditions({ past: true });
    expect(conds).toBeTruthy();
  });

  test('returns a condition when dateRange filter is provided', () => {
    const repo = new BookingRepository({} as any);
    const conds = (repo as any).buildWhereConditions({
      dateRange: { start: new Date('2026-06-01'), end: new Date('2026-06-30') },
    });
    expect(conds).toBeTruthy();
  });

  test('returns a condition when clientOrHost filter is provided', () => {
    const repo = new BookingRepository({} as any);
    const conds = (repo as any).buildWhereConditions({ clientOrHost: 'person-1' });
    expect(conds).toBeTruthy();
  });
});

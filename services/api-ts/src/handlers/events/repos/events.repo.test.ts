/**
 * Tests for EventsRepository
 *
 * All database calls are intercepted by a hand-crafted db stub so no real
 * Postgres connection is needed. We verify that each method calls the correct
 * DB chain and returns/transforms data appropriately.
 */

import { describe, test, expect } from 'bun:test';
import { EventsRepository } from './events.repo';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeEvent(overrides: Record<string, any> = {}) {
  return {
    id: 'evt-1',
    organizationId: 'org-1',
    organizationId: 'org-1',
    title: 'Annual General Assembly',
    description: 'Yearly meeting',
    location: 'Convention Center',
    startDate: new Date('2026-06-15T09:00:00Z'),
    endDate: new Date('2026-06-15T17:00:00Z'),
    capacity: 200,
    registrationFee: 5000,
    currency: 'PHP',
    creditBearing: false,
    creditAmount: 0,
    status: 'published',
    publishedAt: new Date('2026-05-01T00:00:00Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeRegistration(overrides: Record<string, any> = {}) {
  return {
    id: 'reg-1',
    organizationId: 'org-1',
    eventId: 'evt-1',
    personId: 'person-1',
    status: 'confirmed',
    registeredAt: new Date(),
    cancelledAt: null,
    refundedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeCheckIn(overrides: Record<string, any> = {}) {
  return {
    id: 'ci-1',
    organizationId: 'org-1',
    eventId: 'evt-1',
    personId: 'person-1',
    method: 'qr',
    checkedInAt: new Date(),
    checkedInBy: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

/**
 * Build a minimal db stub whose chainable select/update/insert methods
 * resolve to whatever `rows` is provided.
 */
function makeDb({
  selectRows = [] as any[],
  selectRowsSets = undefined as any[][] | undefined,
  insertRow = {} as any,
  updateRow = {} as any,
}: {
  selectRows?: any[];
  selectRowsSets?: any[][];
  insertRow?: any;
  updateRow?: any;
} = {}) {
  let selectCallCount = 0;

  const awaitable = (result: any) => ({
    from: () => awaitable(result),
    leftJoin: () => awaitable(result),
    innerJoin: () => awaitable(result),
    where: () => awaitable(result),
    limit: (_n: number) => awaitable(result),
    returning: () => Promise.resolve(result),
    orderBy: () => awaitable(result),
    offset: (_n: number) => awaitable(result),
    groupBy: () => awaitable(result),
    // Allow direct await on the chain
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  });

  return {
    select: (_fields?: any) => {
      const rows = selectRowsSets
        ? selectRowsSets[selectCallCount++] ?? selectRows
        : selectRows;
      return awaitable(rows);
    },
    insert: (_table: any) => ({
      values: (data: any) => ({
        returning: () =>
          Promise.resolve(Array.isArray(data) ? data.map(() => insertRow) : [insertRow]),
        onConflictDoUpdate: (_opts: any) => ({
          returning: () =>
            Promise.resolve(Array.isArray(data) ? data.map(() => insertRow) : [insertRow]),
        }),
        then: (resolve: any, reject?: any) => Promise.resolve().then(resolve, reject),
      }),
    }),
    update: (_table: any) => ({
      set: (_data: any) => ({
        where: () => ({
          returning: () => Promise.resolve([updateRow]),
        }),
        then: (resolve: any, reject?: any) => Promise.resolve().then(resolve, reject),
      }),
    }),
    delete: (_table: any) => ({
      where: () => Promise.resolve({ rowCount: 1 }),
    }),
  };
}

// ---------------------------------------------------------------------------
// EventsRepository.list
// ---------------------------------------------------------------------------

describe('EventsRepository.list', () => {
  test('returns events and total count for an org', async () => {
    const evt = makeEvent();
    const countRow = { count: 1 };
    const db = makeDb({ selectRowsSets: [[evt], [countRow]] });
    const repo = new EventsRepository(db as any);

    const result = await repo.list('org-1');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('evt-1');
    expect(result.data[0].title).toBe('Annual General Assembly');
    expect(result.total).toBe(1);
  });

  test('returns empty data and zero total when no events', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = new EventsRepository(db as any);

    const result = await repo.list('org-1');
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  test('supports status filter without error', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = new EventsRepository(db as any);

    const result = await repo.list('org-1', { status: 'published' });
    expect(result.data).toEqual([]);
  });

  test('supports search filter without error', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = new EventsRepository(db as any);

    const result = await repo.list('org-1', { search: 'Assembly' });
    expect(result.data).toEqual([]);
  });

  test('supports date range filters without error', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = new EventsRepository(db as any);

    const result = await repo.list('org-1', {
      from: new Date('2026-01-01'),
      to: new Date('2026-12-31'),
    });
    expect(result.data).toEqual([]);
  });

  test('supports pagination via limit and offset', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = new EventsRepository(db as any);

    const result = await repo.list('org-1', { limit: 10, offset: 20 });
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// EventsRepository.get
// ---------------------------------------------------------------------------

describe('EventsRepository.get', () => {
  test('returns event when found', async () => {
    const evt = makeEvent();
    const db = makeDb({ selectRows: [evt] });
    const repo = new EventsRepository(db as any);

    const result = await repo.get('evt-1');
    expect(result).toBeDefined();
    expect(result!.id).toBe('evt-1');
    expect(result!.title).toBe('Annual General Assembly');
    expect(result!.status).toBe('published');
  });

  test('returns undefined when event not found', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new EventsRepository(db as any);

    const result = await repo.get('missing-id');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// EventsRepository.create
// ---------------------------------------------------------------------------

describe('EventsRepository.create', () => {
  test('inserts and returns event record with all fields', async () => {
    const evt = makeEvent();
    const db = makeDb({ insertRow: evt });
    const repo = new EventsRepository(db as any);

    const result = await repo.create({
      organizationId: 'org-1',
      organizationId: 'org-1',
      title: 'Annual General Assembly',
      description: 'Yearly meeting',
      location: 'Convention Center',
      startDate: new Date('2026-06-15T09:00:00Z'),
      endDate: new Date('2026-06-15T17:00:00Z'),
      capacity: 200,
      registrationFee: 5000,
      currency: 'PHP',
      creditBearing: false,
      creditAmount: 0,
      status: 'published',
    } as any);

    expect(result.id).toBe('evt-1');
    expect(result.title).toBe('Annual General Assembly');
    expect(result.capacity).toBe(200);
    expect(result.registrationFee).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// EventsRepository.update
// ---------------------------------------------------------------------------

describe('EventsRepository.update', () => {
  test('partial update returns updated event', async () => {
    const updated = makeEvent({ title: 'Updated Title', updatedAt: new Date() });
    const db = makeDb({ updateRow: updated });
    const repo = new EventsRepository(db as any);

    const result = await repo.update('evt-1', { title: 'Updated Title' } as any);
    expect(result.title).toBe('Updated Title');
  });

  test('sets updatedAt on update', async () => {
    let capturedData: any;
    const db: any = {
      update: (_table: any) => ({
        set: (data: any) => {
          capturedData = data;
          return {
            where: () => ({
              returning: () =>
                Promise.resolve([makeEvent({ title: 'New', updatedAt: data.updatedAt })]),
            }),
          };
        },
      }),
    };

    const repo = new EventsRepository(db);
    await repo.update('evt-1', { title: 'New' } as any);

    expect(capturedData.updatedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// EventsRepository cancel (update status to cancelled)
// ---------------------------------------------------------------------------

describe('EventsRepository cancel (via update)', () => {
  test('updates status to cancelled', async () => {
    const cancelled = makeEvent({ status: 'cancelled' });
    const db = makeDb({ updateRow: cancelled });
    const repo = new EventsRepository(db as any);

    const result = await repo.update('evt-1', { status: 'cancelled' } as any);
    expect(result.status).toBe('cancelled');
  });
});

// ---------------------------------------------------------------------------
// EventsRepository.register
// ---------------------------------------------------------------------------

describe('EventsRepository.register', () => {
  test('creates registration record and returns it', async () => {
    const reg = makeRegistration();
    const db = makeDb({ insertRow: reg });
    const repo = new EventsRepository(db as any);

    const result = await repo.register({
      organizationId: 'org-1',
      eventId: 'evt-1',
      personId: 'person-1',
      status: 'confirmed',
    } as any);

    expect(result.id).toBe('reg-1');
    expect(result.eventId).toBe('evt-1');
    expect(result.personId).toBe('person-1');
    expect(result.status).toBe('confirmed');
  });
});

// ---------------------------------------------------------------------------
// EventsRepository.registerAtomic — P0 capacity/duplicate race fix
// ---------------------------------------------------------------------------

// Builds a db whose .transaction(fn) hands fn a tx that, in call order, serves:
//   1. the event-row FOR UPDATE lock SELECT  → [{ id: 'evt-1' }]
//   2. the existing (event, person) row SELECT → [existingRow] or []
//   3. the confirmed-count SELECT             → [{ count: confirmedCount }]
// and resolves INSERT/UPDATE returning() to the supplied row (or throws on insert).
function makeTxDb(opts: {
  confirmedCount?: number;
  existingRow?: any;
  insertRow?: any;
  updateRow?: any;
  insertThrow?: () => never;
}) {
  const insertRow = opts.insertRow ?? makeRegistration();
  const updateRow = opts.updateRow ?? makeRegistration();
  let selectCall = 0;
  const tx: any = {
    select: (_fields?: any) => {
      const call = selectCall++;
      // 0 = FOR UPDATE lock, 1 = existing-row lookup, 2 = confirmed count
      const rows =
        call === 0
          ? [{ id: 'evt-1' }]
          : call === 1
            ? (opts.existingRow ? [opts.existingRow] : [])
            : [{ count: opts.confirmedCount ?? 0 }];
      const chain: any = {
        from: () => chain,
        where: () => chain,
        for: (_mode: string) => chain, // FOR UPDATE lock
        limit: (_n: number) => Promise.resolve(rows),
        then: (resolve: any, reject?: any) => Promise.resolve(rows).then(resolve, reject),
      };
      return chain;
    },
    insert: (_table: any) => ({
      values: (data: any) => ({
        returning: () => {
          if (opts.insertThrow) opts.insertThrow();
          return Promise.resolve([{ ...insertRow, ...data }]);
        },
      }),
    }),
    update: (_table: any) => ({
      set: (data: any) => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...updateRow, ...data }]),
        }),
      }),
    }),
  };
  return { transaction: async (fn: any) => fn(tx) };
}

describe('EventsRepository.registerAtomic', () => {
  test('confirms (outcome=created) when no existing row and count < capacity', async () => {
    const db = makeTxDb({ confirmedCount: 5 });
    const repo = new EventsRepository(db as any);
    const result = await repo.registerAtomic({
      eventId: 'evt-1', personId: 'p-1', organizationId: 'org-1',
      capacity: 10, createdBy: 'p-1', updatedBy: 'p-1',
    });
    expect(result.status).toBe('confirmed');
    expect(result.outcome).toBe('created');
  });

  test('[P0] waitlists when confirmed count >= capacity (no overflow)', async () => {
    const db = makeTxDb({ confirmedCount: 10 });
    const repo = new EventsRepository(db as any);
    const result = await repo.registerAtomic({
      eventId: 'evt-1', personId: 'p-1', organizationId: 'org-1',
      capacity: 10, createdBy: 'p-1', updatedBy: 'p-1',
    });
    expect(result.status).toBe('waitlisted');
    expect(result.outcome).toBe('created');
  });

  test('confirms regardless of count when capacity is null (unlimited)', async () => {
    const db = makeTxDb({ confirmedCount: 9999 });
    const repo = new EventsRepository(db as any);
    const result = await repo.registerAtomic({
      eventId: 'evt-1', personId: 'p-1', organizationId: 'org-1',
      capacity: null, createdBy: 'p-1', updatedBy: 'p-1',
    });
    expect(result.status).toBe('confirmed');
    expect(result.outcome).toBe('created');
  });

  test('[P0] propagates 23505 from unique-index violation (concurrent double insert)', async () => {
    const db = makeTxDb({
      confirmedCount: 0,
      insertThrow: () => {
        const err = new Error('duplicate key value violates unique constraint "uq_event_reg_active"') as Error & { code: string };
        err.code = '23505';
        throw err;
      },
    });
    const repo = new EventsRepository(db as any);
    await expect(
      repo.registerAtomic({
        eventId: 'evt-1', personId: 'p-1', organizationId: 'org-1',
        capacity: 10, createdBy: 'p-1', updatedBy: 'p-1',
      }),
    ).rejects.toMatchObject({ code: '23505' });
  });

  // ─── P1 single-row transition semantics ───────────────────────────────

  test('[P1] existing noShow row → re-activates SAME row to confirmed (capacity free)', async () => {
    const existing = makeRegistration({ id: 'reg-ns', status: 'noShow' });
    const db = makeTxDb({ existingRow: existing, confirmedCount: 2, updateRow: existing });
    const repo = new EventsRepository(db as any);
    const result = await repo.registerAtomic({
      eventId: 'evt-1', personId: 'person-1', organizationId: 'org-1',
      capacity: 10, createdBy: 'person-1', updatedBy: 'person-1',
    });
    expect(result.outcome).toBe('reactivated');
    expect(result.status).toBe('confirmed');
    expect(result.id).toBe('reg-ns'); // same row, not a new insert
  });

  test('[P1] existing cancelled row → re-activates SAME row to confirmed', async () => {
    const existing = makeRegistration({ id: 'reg-c', status: 'cancelled', cancelledAt: new Date() });
    const db = makeTxDb({ existingRow: existing, confirmedCount: 0, updateRow: existing });
    const repo = new EventsRepository(db as any);
    const result = await repo.registerAtomic({
      eventId: 'evt-1', personId: 'person-1', organizationId: 'org-1',
      capacity: 10, createdBy: 'person-1', updatedBy: 'person-1',
    });
    expect(result.outcome).toBe('reactivated');
    expect(result.status).toBe('confirmed');
    expect(result.id).toBe('reg-c');
  });

  test('[P1] re-activating a terminal row at capacity → waitlisted', async () => {
    const existing = makeRegistration({ id: 'reg-ns', status: 'noShow' });
    const db = makeTxDb({ existingRow: existing, confirmedCount: 10, updateRow: existing });
    const repo = new EventsRepository(db as any);
    const result = await repo.registerAtomic({
      eventId: 'evt-1', personId: 'person-1', organizationId: 'org-1',
      capacity: 10, createdBy: 'person-1', updatedBy: 'person-1',
    });
    expect(result.outcome).toBe('reactivated');
    expect(result.status).toBe('waitlisted');
  });

  test('[P1] existing confirmed row → idempotent, returns it unchanged (no insert)', async () => {
    const existing = makeRegistration({ id: 'reg-ok', status: 'confirmed' });
    const db = makeTxDb({ existingRow: existing });
    const repo = new EventsRepository(db as any);
    const result = await repo.registerAtomic({
      eventId: 'evt-1', personId: 'person-1', organizationId: 'org-1',
      capacity: 10, createdBy: 'person-1', updatedBy: 'person-1',
    });
    expect(result.outcome).toBe('idempotent');
    expect(result.status).toBe('confirmed');
    expect(result.id).toBe('reg-ok');
  });

  test('[P1] existing waitlisted row → idempotent, returns it unchanged (no 23505)', async () => {
    const existing = makeRegistration({ id: 'reg-wl', status: 'waitlisted' });
    const db = makeTxDb({ existingRow: existing });
    const repo = new EventsRepository(db as any);
    const result = await repo.registerAtomic({
      eventId: 'evt-1', personId: 'person-1', organizationId: 'org-1',
      capacity: 10, createdBy: 'person-1', updatedBy: 'person-1',
    });
    expect(result.outcome).toBe('idempotent');
    expect(result.status).toBe('waitlisted');
    expect(result.id).toBe('reg-wl');
  });
});

// ---------------------------------------------------------------------------
// EventsRepository.checkIn
// ---------------------------------------------------------------------------

describe('EventsRepository.checkIn', () => {
  test('creates check-in record and returns it', async () => {
    const ci = makeCheckIn();
    const db = makeDb({ insertRow: ci });
    const repo = new EventsRepository(db as any);

    const result = await repo.checkIn({
      organizationId: 'org-1',
      eventId: 'evt-1',
      personId: 'person-1',
      method: 'qr',
    } as any);

    expect(result.id).toBe('ci-1');
    expect(result.eventId).toBe('evt-1');
    expect(result.personId).toBe('person-1');
    expect(result.method).toBe('qr');
  });
});

// ---------------------------------------------------------------------------
// EventsRepository.listAttendance
// ---------------------------------------------------------------------------

describe('EventsRepository.listAttendance', () => {
  test('returns check-in records for an event', async () => {
    const ci1 = makeCheckIn();
    const ci2 = makeCheckIn({ id: 'ci-2', personId: 'person-2', method: 'manual' });
    const db = makeDb({ selectRows: [ci1, ci2] });
    const repo = new EventsRepository(db as any);

    const result = await repo.listAttendance('evt-1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('ci-1');
    expect(result[1].id).toBe('ci-2');
  });

  test('returns empty array when no check-ins', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new EventsRepository(db as any);

    const result = await repo.listAttendance('evt-1');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// EventsRepository.listByPerson (listMyEvents)
// ---------------------------------------------------------------------------

describe('EventsRepository.listByPerson', () => {
  test('returns events with registrations for a person', async () => {
    const row = {
      registration: makeRegistration(),
      event: makeEvent(),
    };
    const db = makeDb({ selectRows: [row] });
    const repo = new EventsRepository(db as any);

    const result = await repo.listByPerson('person-1');
    expect(result).toHaveLength(1);
    expect(result[0].registration.personId).toBe('person-1');
    expect(result[0].event.title).toBe('Annual General Assembly');
  });

  test('returns empty array when person has no registrations', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new EventsRepository(db as any);

    const result = await repo.listByPerson('person-1');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// EventsRepository.listRegistrations
// ---------------------------------------------------------------------------

describe('EventsRepository.listRegistrations', () => {
  test('returns registrations for an event', async () => {
    const reg1 = makeRegistration();
    const reg2 = makeRegistration({ id: 'reg-2', personId: 'person-2' });
    const db = makeDb({ selectRows: [reg1, reg2] });
    const repo = new EventsRepository(db as any);

    const result = await repo.listRegistrations('evt-1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('reg-1');
    expect(result[1].personId).toBe('person-2');
  });

  test('returns empty array when no registrations', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new EventsRepository(db as any);

    const result = await repo.listRegistrations('evt-1');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// EventsRepository.getRegistrationCount
// ---------------------------------------------------------------------------

describe('EventsRepository.getRegistrationCount', () => {
  test('returns count of confirmed registrations', async () => {
    const db = makeDb({ selectRows: [{ count: 42 }] });
    const repo = new EventsRepository(db as any);

    const result = await repo.getRegistrationCount('evt-1');
    expect(result).toBe(42);
  });

  test('returns 0 when no confirmed registrations', async () => {
    const db = makeDb({ selectRows: [{ count: 0 }] });
    const repo = new EventsRepository(db as any);

    const result = await repo.getRegistrationCount('evt-1');
    expect(result).toBe(0);
  });

  test('returns 0 when count row is undefined', async () => {
    const db = makeDb({ selectRows: [undefined] });
    const repo = new EventsRepository(db as any);

    const result = await repo.getRegistrationCount('evt-1');
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// EventsRepository.isCheckedIn
// ---------------------------------------------------------------------------

describe('EventsRepository.isCheckedIn', () => {
  test('returns true when person has checked in', async () => {
    const db = makeDb({ selectRows: [makeCheckIn()] });
    const repo = new EventsRepository(db as any);

    const result = await repo.isCheckedIn('evt-1', 'person-1');
    expect(result).toBe(true);
  });

  test('returns false when person has not checked in', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new EventsRepository(db as any);

    const result = await repo.isCheckedIn('evt-1', 'person-1');
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EventsRepository.getAttendanceStats
// ---------------------------------------------------------------------------

describe('EventsRepository.getAttendanceStats', () => {
  test('returns attendance stats with method breakdown', async () => {
    const stats = { total: 50, qr: 35, manual: 15 };
    const db = makeDb({ selectRows: [stats] });
    const repo = new EventsRepository(db as any);

    const result = await repo.getAttendanceStats('evt-1');
    expect(result!.total).toBe(50);
    expect(result!.qr).toBe(35);
    expect(result!.manual).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// EventsRepository.getStats
// ---------------------------------------------------------------------------

describe('EventsRepository.getStats', () => {
  test('returns aggregated stats for the org', async () => {
    const stats = { totalThisMonth: 3, totalRegistrations: 0 };
    const db = makeDb({ selectRows: [stats] });
    const repo = new EventsRepository(db as any);

    const result = await repo.getStats('org-1');
    expect(result!.totalThisMonth).toBe(3);
    expect(result!.totalRegistrations).toBe(0);
  });
});

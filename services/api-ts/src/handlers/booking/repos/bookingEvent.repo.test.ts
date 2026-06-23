/**
 * Tests for BookingEventRepository
 *
 * Tests cover CRUD operations, smart defaults, change detection for slot
 * regeneration, configuration validation, and the pure helper methods
 * (getDailyConfig, isOwnerAvailableOnDay, validateEventConfig).
 *
 * All database interactions are stubbed — no real Postgres needed.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { BookingEventRepository } from './bookingEvent.repo';
import { ValidationError } from '@/core/errors';
import { DayOfWeek } from './booking.schema';
import type { BookingEvent, BookingEventCreateRequest, DailyConfig } from './booking.schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDailyConfigs(
  enabledDays: DayOfWeek[] = [DayOfWeek.mon, DayOfWeek.wed, DayOfWeek.fri]
): Record<DayOfWeek, DailyConfig> {
  const base: Record<DayOfWeek, DailyConfig> = {} as any;
  for (const d of Object.values(DayOfWeek)) {
    base[d] = { enabled: false, timeBlocks: [] };
  }
  for (const d of enabledDays) {
    base[d] = {
      enabled: true,
      timeBlocks: [{ startTime: '09:00', endTime: '17:00', slotDuration: 30, bufferTime: 0 }],
    };
  }
  return base;
}

function makeEvent(overrides: Record<string, any> = {}): BookingEvent {
  return {
    id: 'event-1',
    owner: 'owner-1',
    title: 'Consultation',
    description: null,
    keywords: [],
    tags: [],
    context: null,
    timezone: 'America/New_York',
    locationTypes: ['video', 'phone', 'in-person'],
    maxBookingDays: 30,
    minBookingMinutes: 1440,
    formConfig: null,
    billingConfig: null,
    status: 'active',
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    dailyConfigs: makeDailyConfigs(),
    createdBy: 'owner-1',
    updatedBy: 'owner-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  } as any;
}

function makeCreateRequest(
  overrides: Partial<BookingEventCreateRequest> = {}
): BookingEventCreateRequest {
  return {
    title: 'Test Event',
    timezone: 'America/New_York',
    dailyConfigs: makeDailyConfigs(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getDailyConfig (pure method — no DB)
// ---------------------------------------------------------------------------

describe('BookingEventRepository.getDailyConfig', () => {
  const repo = new BookingEventRepository({} as any);

  test('returns null when day is not in dailyConfigs', () => {
    const event = makeEvent({ dailyConfigs: {} });
    expect(repo.getDailyConfig(event, DayOfWeek.sun)).toBeNull();
  });

  test('returns null when day config is disabled', () => {
    const configs = makeDailyConfigs([]);
    configs[DayOfWeek.mon] = { enabled: false, timeBlocks: [] };
    const event = makeEvent({ dailyConfigs: configs });
    expect(repo.getDailyConfig(event, DayOfWeek.mon)).toBeNull();
  });

  test('returns config when day is enabled', () => {
    const event = makeEvent();
    const config = repo.getDailyConfig(event, DayOfWeek.mon);
    expect(config).not.toBeNull();
    expect(config?.enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isOwnerAvailableOnDay (pure method — no DB)
// ---------------------------------------------------------------------------

describe('BookingEventRepository.isOwnerAvailableOnDay', () => {
  const repo = new BookingEventRepository({} as any);

  test('returns false when day is disabled', () => {
    const configs = makeDailyConfigs([DayOfWeek.mon]);
    configs[DayOfWeek.tue] = { enabled: false, timeBlocks: [] };
    const event = makeEvent({ dailyConfigs: configs });
    expect(repo.isOwnerAvailableOnDay(event, DayOfWeek.tue)).toBe(false);
  });

  test('returns false when day is enabled but has no time blocks', () => {
    const configs = makeDailyConfigs([]);
    configs[DayOfWeek.mon] = { enabled: true, timeBlocks: [] };
    const event = makeEvent({ dailyConfigs: configs });
    expect(repo.isOwnerAvailableOnDay(event, DayOfWeek.mon)).toBe(false);
  });

  test('returns true when day is enabled with time blocks', () => {
    const event = makeEvent(); // Mon/Wed/Fri enabled
    expect(repo.isOwnerAvailableOnDay(event, DayOfWeek.mon)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateEventConfig (pure method — no DB)
// ---------------------------------------------------------------------------

describe('BookingEventRepository.validateEventConfig', () => {
  const repo = new BookingEventRepository({} as any);

  test('returns empty errors for valid config', () => {
    const errors = repo.validateEventConfig(makeCreateRequest());
    expect(errors).toEqual([]);
  });

  test('rejects maxBookingDays > 365', () => {
    const errors = repo.validateEventConfig(makeCreateRequest({ maxBookingDays: 400 }));
    expect(errors.some(e => e.includes('maxBookingDays'))).toBe(true);
  });

  test('rejects maxBookingDays < 0', () => {
    const errors = repo.validateEventConfig(makeCreateRequest({ maxBookingDays: -1 }));
    expect(errors.some(e => e.includes('maxBookingDays'))).toBe(true);
  });

  test('rejects minBookingMinutes > 4320', () => {
    const errors = repo.validateEventConfig(makeCreateRequest({ minBookingMinutes: 5000 }));
    expect(errors.some(e => e.includes('minBookingMinutes'))).toBe(true);
  });

  test('rejects empty locationTypes array', () => {
    const errors = repo.validateEventConfig(makeCreateRequest({ locationTypes: [] }));
    expect(errors.some(e => e.includes('locationType'))).toBe(true);
  });

  // [BR-75] effectiveTo must be after effectiveFrom — previously only a DB CHECK
  // (raw 500 leak); now validated up front so the wire returns a clean 400.
  test('[BR-75] rejects effectiveTo on/before effectiveFrom', () => {
    const before = repo.validateEventConfig(
      makeCreateRequest({ effectiveFrom: '2026-12-31T00:00:00Z', effectiveTo: '2026-01-01T00:00:00Z' } as any),
    );
    expect(before.some(e => e.includes('effectiveTo'))).toBe(true);
    const equal = repo.validateEventConfig(
      makeCreateRequest({ effectiveFrom: '2026-06-01T00:00:00Z', effectiveTo: '2026-06-01T00:00:00Z' } as any),
    );
    expect(equal.some(e => e.includes('effectiveTo'))).toBe(true);
  });

  test('[BR-75] accepts effectiveTo after effectiveFrom', () => {
    const errors = repo.validateEventConfig(
      makeCreateRequest({ effectiveFrom: '2026-01-01T00:00:00Z', effectiveTo: '2026-12-31T00:00:00Z' } as any),
    );
    expect(errors).toEqual([]);
  });

  test('rejects invalid timezone format', () => {
    const errors = repo.validateEventConfig(makeCreateRequest({ timezone: 'UTC' }));
    // 'UTC' has no slash so fails the regex
    expect(errors.some(e => e.includes('timezone'))).toBe(true);
  });

  test('accepts valid IANA timezone', () => {
    const errors = repo.validateEventConfig(makeCreateRequest({ timezone: 'America/Toronto' }));
    expect(errors).toEqual([]);
  });

  test('rejects invalid time block startTime format', () => {
    const badConfigs = makeDailyConfigs([DayOfWeek.mon]);
    badConfigs[DayOfWeek.mon] = {
      enabled: true,
      timeBlocks: [{ startTime: '9:00', endTime: '17:00' }], // missing leading zero
    };
    const errors = repo.validateEventConfig(makeCreateRequest({ dailyConfigs: badConfigs }));
    expect(errors.length).toBeGreaterThan(0);
  });

  test('rejects overlapping time blocks on same day', () => {
    const badConfigs = makeDailyConfigs([DayOfWeek.mon]);
    badConfigs[DayOfWeek.mon] = {
      enabled: true,
      timeBlocks: [
        { startTime: '09:00', endTime: '13:00' },
        { startTime: '12:00', endTime: '17:00' }, // overlaps previous block
      ],
    };
    const errors = repo.validateEventConfig(makeCreateRequest({ dailyConfigs: badConfigs }));
    expect(errors.length).toBeGreaterThan(0);
  });

  test('rejects slotDuration < 15', () => {
    const badConfigs = makeDailyConfigs([DayOfWeek.mon]);
    badConfigs[DayOfWeek.mon] = {
      enabled: true,
      timeBlocks: [{ startTime: '09:00', endTime: '17:00', slotDuration: 10 }],
    };
    const errors = repo.validateEventConfig(makeCreateRequest({ dailyConfigs: badConfigs }));
    expect(errors.length).toBeGreaterThan(0);
  });

  test('rejects slotDuration > 480', () => {
    const badConfigs = makeDailyConfigs([DayOfWeek.mon]);
    badConfigs[DayOfWeek.mon] = {
      enabled: true,
      timeBlocks: [{ startTime: '09:00', endTime: '17:00', slotDuration: 500 }],
    };
    const errors = repo.validateEventConfig(makeCreateRequest({ dailyConfigs: badConfigs }));
    expect(errors.length).toBeGreaterThan(0);
  });

  test('rejects bufferTime > 120', () => {
    const badConfigs = makeDailyConfigs([DayOfWeek.mon]);
    badConfigs[DayOfWeek.mon] = {
      enabled: true,
      timeBlocks: [{ startTime: '09:00', endTime: '17:00', bufferTime: 130 }],
    };
    const errors = repo.validateEventConfig(makeCreateRequest({ dailyConfigs: badConfigs }));
    expect(errors.length).toBeGreaterThan(0);
  });

  test('rejects startTime >= endTime', () => {
    const badConfigs = makeDailyConfigs([DayOfWeek.mon]);
    badConfigs[DayOfWeek.mon] = {
      enabled: true,
      timeBlocks: [{ startTime: '17:00', endTime: '09:00' }],
    };
    const errors = repo.validateEventConfig(makeCreateRequest({ dailyConfigs: badConfigs }));
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// createWithSmartDefaults
// ---------------------------------------------------------------------------

describe('BookingEventRepository.createWithSmartDefaults', () => {
  test('throws if dailyConfigs is missing', async () => {
    const repo = new BookingEventRepository({} as any);
    const request: any = { title: 'No Configs' };
    await expect(repo.createWithSmartDefaults('owner-1', request)).rejects.toThrow();
  });

  test('applies default timezone when not provided', async () => {
    let capturedData: any;
    const db: any = {
      insert: () => ({
        values: (data: any) => {
          capturedData = data;
          return { returning: () => Promise.resolve([{ ...data, id: 'evt-1' }]) };
        },
      }),
    };

    const repo = new BookingEventRepository(db);
    const request = makeCreateRequest({ timezone: undefined });
    await repo.createWithSmartDefaults('owner-1', request);
    expect(capturedData.timezone).toBe('America/New_York');
  });

  test('applies default maxBookingDays when not provided', async () => {
    let capturedData: any;
    const db: any = {
      insert: () => ({
        values: (data: any) => {
          capturedData = data;
          return { returning: () => Promise.resolve([{ ...data, id: 'evt-1' }]) };
        },
      }),
    };

    const repo = new BookingEventRepository(db);
    await repo.createWithSmartDefaults('owner-1', makeCreateRequest({ maxBookingDays: undefined }));
    expect(capturedData.maxBookingDays).toBe(30);
  });

  test('applies default minBookingMinutes when not provided', async () => {
    let capturedData: any;
    const db: any = {
      insert: () => ({
        values: (data: any) => {
          capturedData = data;
          return { returning: () => Promise.resolve([{ ...data, id: 'evt-1' }]) };
        },
      }),
    };

    const repo = new BookingEventRepository(db);
    await repo.createWithSmartDefaults('owner-1', makeCreateRequest({ minBookingMinutes: undefined }));
    expect(capturedData.minBookingMinutes).toBe(1440);
  });

  test('applies default slotDuration in time blocks', async () => {
    let capturedData: any;
    const configs = makeDailyConfigs([DayOfWeek.mon]);
    // Omit slotDuration from the block
    configs[DayOfWeek.mon] = {
      enabled: true,
      timeBlocks: [{ startTime: '09:00', endTime: '17:00' }],
    };

    const db: any = {
      insert: () => ({
        values: (data: any) => {
          capturedData = data;
          return { returning: () => Promise.resolve([{ ...data, id: 'evt-1' }]) };
        },
      }),
    };

    const repo = new BookingEventRepository(db);
    await repo.createWithSmartDefaults('owner-1', makeCreateRequest({ dailyConfigs: configs }));
    const monBlock = capturedData.dailyConfigs[DayOfWeek.mon]?.timeBlocks?.[0];
    expect(monBlock?.slotDuration).toBe(30); // default applied
  });

  test('sets status to active by default', async () => {
    let capturedData: any;
    const db: any = {
      insert: () => ({
        values: (data: any) => {
          capturedData = data;
          return { returning: () => Promise.resolve([{ ...data, id: 'evt-1' }]) };
        },
      }),
    };

    const repo = new BookingEventRepository(db);
    await repo.createWithSmartDefaults('owner-1', makeCreateRequest());
    expect(capturedData.status).toBe('active');
  });

  test('respects explicitly provided status', async () => {
    let capturedData: any;
    const db: any = {
      insert: () => ({
        values: (data: any) => {
          capturedData = data;
          return { returning: () => Promise.resolve([{ ...data, id: 'evt-1' }]) };
        },
      }),
    };

    const repo = new BookingEventRepository(db);
    await repo.createWithSmartDefaults('owner-1', makeCreateRequest({ status: 'draft' }));
    expect(capturedData.status).toBe('draft');
  });
});

// ---------------------------------------------------------------------------
// updateWithChangeDetection — slot regeneration flag
// ---------------------------------------------------------------------------

describe('BookingEventRepository.updateWithChangeDetection', () => {
  function makeRepoWithCurrentEvent(currentEvent: BookingEvent) {
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
    // Patch findOneById to avoid full ORM chain complexity
    (repo as any).findOneById = async (_id: string) => currentEvent;
    return repo;
  }

  test('detects timezone change as requiring regeneration', async () => {
    const current = makeEvent({ timezone: 'America/New_York' });
    const repo = makeRepoWithCurrentEvent(current);

    const result = await repo.updateWithChangeDetection('event-1', {
      timezone: 'America/Los_Angeles',
    });

    expect(result.requiresSlotRegeneration).toBe(true);
    expect(result.changes).toContain('timezone');
  });

  test('detects dailyConfigs change as requiring regeneration', async () => {
    const current = makeEvent();
    const repo = makeRepoWithCurrentEvent(current);

    const newConfigs = makeDailyConfigs([DayOfWeek.tue, DayOfWeek.thu]);
    const result = await repo.updateWithChangeDetection('event-1', {
      dailyConfigs: newConfigs,
    });

    expect(result.requiresSlotRegeneration).toBe(true);
    expect(result.changes).toContain('dailyConfigs');
  });

  test('detects status change as requiring regeneration', async () => {
    const current = makeEvent({ status: 'active' });
    const repo = makeRepoWithCurrentEvent(current);

    const result = await repo.updateWithChangeDetection('event-1', {
      status: 'paused',
    });

    expect(result.requiresSlotRegeneration).toBe(true);
    expect(result.changes).toContain('status');
  });

  test('minor change (title) does not require regeneration', async () => {
    const current = makeEvent({ title: 'Old Title' });
    const repo = makeRepoWithCurrentEvent(current);

    const result = await repo.updateWithChangeDetection('event-1', {
      title: 'New Title',
    });

    expect(result.requiresSlotRegeneration).toBe(false);
    expect(result.changes).toContain('title');
  });

  test('no changes detected when values are identical', async () => {
    const current = makeEvent({ title: 'Same Title' });
    const repo = makeRepoWithCurrentEvent(current);

    const result = await repo.updateWithChangeDetection('event-1', {
      title: 'Same Title',
    });

    expect(result.requiresSlotRegeneration).toBe(false);
    expect(result.changes).toHaveLength(0);
  });

  test('throws when event not found', async () => {
    const db: any = {};
    const repo = new BookingEventRepository(db);
    (repo as any).findOneById = async (_id: string) => null;

    await expect(
      repo.updateWithChangeDetection('missing', { title: 'x' })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// archiveEvent
// ---------------------------------------------------------------------------

describe('BookingEventRepository.archiveEvent', () => {
  test('sets status to archived', async () => {
    const current = makeEvent({ status: 'active' });
    const db: any = {};
    const repo = new BookingEventRepository(db);
    (repo as any).updateOneById = async (_id: string, data: any) => ({ ...current, ...data });

    const result = await repo.archiveEvent('event-1');
    expect(result.status).toBe('archived');
  });
});

// ---------------------------------------------------------------------------
// buildWhereConditions filter coverage
// ---------------------------------------------------------------------------

describe('BookingEventRepository.buildWhereConditions', () => {
  const repo = new BookingEventRepository({} as any);

  test('returns undefined for no filters', () => {
    const conds = (repo as any).buildWhereConditions(undefined);
    expect(conds).toBeUndefined();
  });

  test('returns condition for owner filter', () => {
    const conds = (repo as any).buildWhereConditions({ owner: 'o-1' });
    expect(conds).toBeTruthy();
  });

  test('returns condition for status filter', () => {
    const conds = (repo as any).buildWhereConditions({ status: 'active' });
    expect(conds).toBeTruthy();
  });

  test('returns condition for effectiveDate filter', () => {
    const conds = (repo as any).buildWhereConditions({ effectiveDate: '2026-06-15' });
    expect(conds).toBeTruthy();
  });

  test('returns condition for dateRange filter', () => {
    const conds = (repo as any).buildWhereConditions({
      dateRangeStart: new Date('2026-06-01'),
      dateRangeEnd: new Date('2026-06-30'),
    });
    expect(conds).toBeTruthy();
  });

  test('returns condition for context filter', () => {
    const conds = (repo as any).buildWhereConditions({ context: 'ctx-1' });
    expect(conds).toBeTruthy();
  });

  test('returns condition for q (search) filter', () => {
    const conds = (repo as any).buildWhereConditions({ q: 'consultation' });
    expect(conds).toBeTruthy();
  });

  test('returns condition for tagsOr filter', () => {
    const conds = (repo as any).buildWhereConditions({ tagsOr: ['urgent'] });
    expect(conds).toBeTruthy();
  });

  test('returns condition for tagsAnd filter', () => {
    const conds = (repo as any).buildWhereConditions({ tagsAnd: ['vip', 'premium'] });
    expect(conds).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// dailyConfigs day-key validation (B1 follow-up item3 — silent-zero-slot trap)
//
// Generators key on the 3-letter DayOfWeek enum ('sun'..'sat'). A config keyed
// by a full day-name like 'monday' previously passed validation untouched, then
// produced ZERO slots with no error because dailyConfigs['mon'] was undefined.
// processAndValidateDailyConfigs must now REJECT unknown keys (fail-fast).
// ---------------------------------------------------------------------------

describe('BookingEventRepository dailyConfigs day-key validation', () => {
  const stubDb: any = {
    insert: () => ({
      values: (data: any) => ({
        returning: () => Promise.resolve([{ ...data, id: 'evt-1' }]),
      }),
    }),
  };

  test('rejects a full day-name key (monday) naming the bad key', async () => {
    const repo = new BookingEventRepository(stubDb);
    // Build a config keyed by the invalid full day-name 'monday'.
    const badConfigs: any = {
      monday: {
        enabled: true,
        timeBlocks: [{ startTime: '09:00', endTime: '17:00', slotDuration: 30, bufferTime: 0 }],
      },
    };

    let caught: unknown;
    try {
      await repo.createWithSmartDefaults('owner-1', makeCreateRequest({ dailyConfigs: badConfigs }));
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as Error).message).toContain('monday');
  });

  test('accepts a correctly abbreviated key (mon)', async () => {
    const repo = new BookingEventRepository(stubDb);
    const goodConfigs = makeDailyConfigs([DayOfWeek.mon]);

    await expect(
      repo.createWithSmartDefaults('owner-1', makeCreateRequest({ dailyConfigs: goodConfigs }))
    ).resolves.toBeTruthy();
  });
});

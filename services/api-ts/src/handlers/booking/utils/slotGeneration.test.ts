/**
 * Unit suite for slotGeneration.ts — the heart of availability math, which had
 * no dedicated test file (only indirect coverage).
 *
 * Pure functions, so no DB. Covers slot count / partial-slot rule, buffer
 * interval, timezone correctness (tz-offset delta, robust to the runner's tz),
 * disabled-day + effective-window clamps, validateSlotBoundaries, and
 * batchGenerateSlots batching.
 *
 * Also RED-then-fixes a latent bug: generateSlotsForDay read non-existent
 * event.minBookingHours / event.advanceBookingDays (schema fields are
 * minBookingMinutes / maxBookingDays), so the min-notice + advance-window
 * constraints silently no-op'd. The two "latent bug" tests below assert the
 * CORRECT behaviour (RED before the fix, GREEN after).
 */
import { describe, test, expect } from 'bun:test';
import { addDays, startOfDay } from 'date-fns';
import {
  generateSlotsForEvent,
  validateSlotBoundaries,
  batchGenerateSlots,
  getNextBookableTime,
  type GeneratedSlot,
} from './slotGeneration';
import type { BookingEvent } from '../repos/booking.schema';

interface Block { startTime: string; endTime: string; slotDuration: number; bufferTime: number }
const BLOCK: Block = { startTime: '09:00', endTime: '10:00', slotDuration: 30, bufferTime: 0 };

function allDays(block: Block) {
  const d: Record<string, unknown> = {};
  for (const k of ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']) d[k] = { enabled: true, timeBlocks: [block] };
  return d;
}

function makeEvent(o: Partial<Record<string, unknown>> = {}): BookingEvent {
  return {
    id: 'evt-1',
    owner: 'owner-1',
    organizationId: 'org-1',
    context: null,
    timezone: 'UTC',
    locationTypes: ['video'],
    billingConfig: null,
    minBookingMinutes: 0,
    maxBookingDays: 365,
    effectiveFrom: new Date('2020-01-01T00:00:00Z'),
    effectiveTo: null,
    dailyConfigs: allDays(BLOCK),
    ...o,
  } as unknown as BookingEvent;
}

// A date comfortably in the future (after min-notice=0, within advance window).
const FUT = addDays(startOfDay(new Date()), 5);

describe('generateSlotsForEvent — slot math', () => {
  test('09:00–10:00 @30min/0buffer yields exactly 2 slots (:00,:30), no partial past dayEnd', () => {
    const slots = generateSlotsForEvent({ event: makeEvent(), startDate: FUT, endDate: FUT });
    expect(slots.length).toBe(2);
    expect(slots[0]!.startTime.getUTCHours()).toBe(9);
    expect(slots[0]!.startTime.getUTCMinutes()).toBe(0);
    expect(slots[1]!.startTime.getUTCMinutes()).toBe(30);
    // interval = duration + buffer = 30.
    expect((slots[1]!.startTime.getTime() - slots[0]!.startTime.getTime()) / 60000).toBe(30);
    // No slot ends past dayEnd (10:00): last slot ends 09:30+30=10:00.
    expect(slots[1]!.endTime.getUTCHours()).toBe(10);
    expect(slots[1]!.endTime.getUTCMinutes()).toBe(0);
  });

  test('buffer math: 09:00–10:30 @30min/15buffer yields slots 45 min apart (09:00, 09:45)', () => {
    const ev = makeEvent({ dailyConfigs: allDays({ startTime: '09:00', endTime: '10:30', slotDuration: 30, bufferTime: 15 }) });
    const slots = generateSlotsForEvent({ event: ev, startDate: FUT, endDate: FUT });
    expect(slots.length).toBe(2);
    expect((slots[1]!.startTime.getTime() - slots[0]!.startTime.getTime()) / 60000).toBe(45);
  });

  test('timezone: a Manila event\'s 09:00 slot is 8h earlier in UTC than the same UTC event', () => {
    const utc = generateSlotsForEvent({ event: makeEvent({ timezone: 'UTC' }), startDate: FUT, endDate: FUT });
    const mnl = generateSlotsForEvent({ event: makeEvent({ timezone: 'Asia/Manila' }), startDate: FUT, endDate: FUT });
    expect(utc.length).toBeGreaterThan(0);
    expect(mnl.length).toBe(utc.length);
    // 09:00 UTC = 09:00Z; 09:00 Manila = 01:00Z → UTC slot is +8h vs Manila slot.
    expect((utc[0]!.startTime.getTime() - mnl[0]!.startTime.getTime()) / 3600000).toBe(8);
  });

  test('disabled day → 0 slots; effective_to before the date clamps to 0', () => {
    const disabled = makeEvent({ dailyConfigs: { mon: { enabled: false, timeBlocks: [BLOCK] } } });
    expect(generateSlotsForEvent({ event: disabled, startDate: FUT, endDate: FUT }).length).toBe(0);

    const clamped = makeEvent({ effectiveTo: addDays(startOfDay(new Date()), 2) });
    expect(generateSlotsForEvent({ event: clamped, startDate: FUT, endDate: FUT }).length).toBe(0);
  });
});

describe('generateSlotsForDay — latent min-notice / advance-window bug (RED→fix)', () => {
  test('minBookingMinutes filters slots inside the notice window', () => {
    // 72h min notice; generate for TOMORROW (~24h out) → every slot is inside
    // the window → 0 slots. (Before the fix, minBookingHours was read instead —
    // undefined → 0 → no filtering → slots leaked.)
    const ev = makeEvent({ minBookingMinutes: 4320 });
    const tomorrow = addDays(startOfDay(new Date()), 1);
    const slots = generateSlotsForEvent({ event: ev, startDate: tomorrow, endDate: tomorrow });
    expect(slots.length).toBe(0);
  });

  test('maxBookingDays caps the advance window', () => {
    // 1-day advance window; generate for 10 days out → beyond window → 0 slots.
    // (Before the fix, advanceBookingDays was read → undefined → 365 → leaked.)
    const ev = makeEvent({ maxBookingDays: 1, minBookingMinutes: 0 });
    const tenDays = addDays(startOfDay(new Date()), 10);
    const slots = generateSlotsForEvent({ event: ev, startDate: tenDays, endDate: tenDays });
    expect(slots.length).toBe(0);
  });
});

describe('validateSlotBoundaries', () => {
  const mk = (date: string, startISO: string, endISO: string): GeneratedSlot => ({
    owner: 'o', event: 'e', date, startTime: new Date(startISO), endTime: new Date(endISO),
    locationTypes: ['video'], status: 'available',
  } as unknown as GeneratedSlot);

  test('partitions valid (correct duration + interval) vs invalid (wrong duration)', () => {
    const s1 = mk('2030-01-01', '2030-01-01T09:00:00Z', '2030-01-01T09:30:00Z'); // 30
    const s2 = mk('2030-01-01', '2030-01-01T09:30:00Z', '2030-01-01T10:00:00Z'); // 30, interval 30
    const { valid, invalid } = validateSlotBoundaries([s1, s2], 30, 0);
    expect(valid.length).toBe(2);
    expect(invalid.length).toBe(0);

    const bad = mk('2030-01-02', '2030-01-02T09:00:00Z', '2030-01-02T09:45:00Z'); // 45 ≠ 30
    const r2 = validateSlotBoundaries([bad], 30, 0);
    expect(r2.invalid.length).toBe(1);
    expect(r2.valid.length).toBe(0);
  });
});

describe('batchGenerateSlots', () => {
  test('processes more than one batch (12 events > batchSize 10) and returns all slots', async () => {
    const events = Array.from({ length: 12 }, (_, i) => makeEvent({ id: `e${i}`, owner: `o${i}` }));
    const slots = await batchGenerateSlots(events, { start: FUT, end: FUT }, new Map());
    expect(slots.length).toBe(12 * 2); // each event → 2 slots
  });
});

/**
 * getNextBookableTime reads `new Date()` internally, so we pin `now` via a
 * fixed-Date shim (local components → tz-robust) to assert the exact rounding.
 */
function withFixedNow<T>(y: number, mo: number, d: number, h: number, mi: number, s: number, ms: number, fn: () => T): T {
  const Real = Date;
  const fixedMs = new Real(y, mo, d, h, mi, s, ms).getTime();
  // @ts-expect-error — test-only Date override
  globalThis.Date = class extends Real {
    constructor(...args: unknown[]) { super(...(args.length ? (args as []) : [fixedMs])); }
    static now() { return fixedMs; }
  };
  try { return fn(); } finally { globalThis.Date = Real; }
}

describe('getNextBookableTime — round up to the next 15-min boundary', () => {
  test('a sub-minute remainder on a boundary (14:45:20) rounds UP to 15:00 (never down into the past)', () => {
    const r = withFixedNow(2030, 0, 1, 14, 45, 20, 500, () => getNextBookableTime(0));
    expect(r.getHours()).toBe(15);
    expect(r.getMinutes()).toBe(0);
    expect(r.getSeconds()).toBe(0);
    expect(r.getMilliseconds()).toBe(0);
  });

  test('exactly on a boundary with no remainder (14:45:00) stays at 14:45', () => {
    const r = withFixedNow(2030, 0, 1, 14, 45, 0, 0, () => getNextBookableTime(0));
    expect(r.getHours()).toBe(14);
    expect(r.getMinutes()).toBe(45);
    expect(r.getSeconds()).toBe(0);
  });

  test('rollover at :60 advances the hour and zeroes minutes (14:50 → 15:00)', () => {
    const r = withFixedNow(2030, 0, 1, 14, 50, 0, 0, () => getNextBookableTime(0));
    expect(r.getHours()).toBe(15);
    expect(r.getMinutes()).toBe(0);
  });

  test('minBookingHours offset applies before rounding (10:00 + 2h → 12:00)', () => {
    const r = withFixedNow(2030, 0, 1, 10, 0, 0, 0, () => getNextBookableTime(2));
    expect(r.getHours()).toBe(12);
    expect(r.getMinutes()).toBe(0);
  });
});

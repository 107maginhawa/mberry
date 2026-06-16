/**
 * Integration coverage for ScheduleExceptionRepository against real Postgres.
 *
 * Covers buildWhereConditions all branches (event/owner/context/dateRange/recurring),
 * createExceptionForEvent (success: org provided vs inherited, timezone provided vs
 * inherited; NotFoundError when event missing), findOverlappingExceptions, and
 * generateRecurrenceOccurrences (non-recurring single; daily/weekly/monthly; maxOccurrences
 * cap; pattern.endDate vs untilDate). Skips when Postgres unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import { ScheduleExceptionRepository } from './scheduleException.repo';
import { NotFoundError } from '@/core/errors';
import type { ScheduleException } from './booking.schema';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

let pool: Pool;
let db: ReturnType<typeof drizzle>;
let dbReachable = false;
let repo: ScheduleExceptionRepository;

const OWNER = randomUUID();
const EVENT = randomUUID();
const EVENT_ORG = randomUUID();
const CONTEXT = 'ctx-' + randomUUID();
const EVENT_TZ = 'America/New_York';

beforeAll(async () => {
  pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const c = await pool.connect();
    c.release();
    db = drizzle(pool);
    dbReachable = true;
  } catch (err) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.warn(`[scheduleException.repo integration] Postgres unreachable; skipping. ${(err as Error).message}`);
    return;
  }

  repo = new ScheduleExceptionRepository(db as any);

  await pool.query(`INSERT INTO person (id, first_name) VALUES ($1,'SE Owner') ON CONFLICT DO NOTHING`, [OWNER]);
  await pool.query(
    `INSERT INTO booking_event (id, organization_id, owner_id, context_id, title, timezone, location_types, daily_configs, status)
     VALUES ($1,$2,$3,$4,'SE Event',$5,'["video"]'::jsonb,'{}'::jsonb,'active') ON CONFLICT DO NOTHING`,
    [EVENT, EVENT_ORG, OWNER, CONTEXT, EVENT_TZ],
  );
});

afterAll(async () => {
  if (pool) {
    if (dbReachable) {
      await pool.query(`DELETE FROM schedule_exception WHERE event_id=$1`, [EVENT]);
      await pool.query(`DELETE FROM booking_event WHERE id=$1`, [EVENT]);
      await pool.query(`DELETE FROM person WHERE id=$1`, [OWNER]);
    }
    await pool.end();
  }
});

const day = (iso: string) => new Date(iso);

describe('ScheduleExceptionRepository (real-PG)', () => {
  test('createExceptionForEvent: inherits org/context/timezone from event', async () => {
    if (!dbReachable) return;
    const exc = await repo.createExceptionForEvent(EVENT, OWNER, {
      startDatetime: '2031-03-01T09:00:00Z',
      endDatetime: '2031-03-01T17:00:00Z',
      reason: 'Conference',
    });
    expect(exc.event).toBe(EVENT);
    expect(exc.owner).toBe(OWNER);
    expect(exc.organizationId).toBe(EVENT_ORG);
    expect(exc.context).toBe(CONTEXT);
    expect(exc.timezone).toBe(EVENT_TZ);
    expect(exc.reason).toBe('Conference');
    expect(exc.recurring).toBe(false);
  });

  test('createExceptionForEvent: explicit organizationId + timezone override inheritance', async () => {
    if (!dbReachable) return;
    const overrideOrg = randomUUID();
    const exc = await repo.createExceptionForEvent(
      EVENT,
      OWNER,
      {
        startDatetime: '2031-03-05T09:00:00Z',
        endDatetime: '2031-03-05T12:00:00Z',
        timezone: 'Asia/Manila',
        recurring: true,
        recurrencePattern: { type: 'weekly', interval: 1 },
      },
      overrideOrg,
    );
    expect(exc.organizationId).toBe(overrideOrg);
    expect(exc.timezone).toBe('Asia/Manila');
    expect(exc.recurring).toBe(true);
    // reason omitted → defaults to '' per source
    expect(exc.reason).toBe('');
  });

  test('createExceptionForEvent: throws NotFoundError when event missing', async () => {
    if (!dbReachable) return;
    let err: unknown;
    try {
      await repo.createExceptionForEvent(randomUUID(), OWNER, {
        startDatetime: '2031-03-01T09:00:00Z',
        endDatetime: '2031-03-01T10:00:00Z',
        reason: 'x',
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(NotFoundError);
  });

  test('buildWhereConditions: event / owner / context / recurring branches', async () => {
    if (!dbReachable) return;
    const byEvent = await (repo as any).findMany({ event: EVENT });
    expect(byEvent.length).toBeGreaterThanOrEqual(2);

    const byOwner = await (repo as any).findMany({ owner: OWNER });
    expect(byOwner.every((e: ScheduleException) => e.owner === OWNER)).toBe(true);

    const byContext = await (repo as any).findMany({ context: CONTEXT });
    expect(byContext.every((e: ScheduleException) => e.context === CONTEXT)).toBe(true);

    const recurring = await (repo as any).findMany({ recurring: true });
    expect(recurring.every((e: ScheduleException) => e.recurring === true)).toBe(true);

    const nonRecurring = await (repo as any).findMany({ event: EVENT, recurring: false });
    expect(nonRecurring.every((e: ScheduleException) => e.recurring === false)).toBe(true);
  });

  test('buildWhereConditions: dateRange branch + undefined (no filters)', async () => {
    if (!dbReachable) return;
    const inRange = await (repo as any).findMany({
      event: EVENT,
      dateRange: { start: day('2031-03-01T00:00:00Z'), end: day('2031-03-02T00:00:00Z') },
    });
    expect(inRange.length).toBeGreaterThanOrEqual(1);

    const all = await (repo as any).findMany();
    expect(Array.isArray(all)).toBe(true);
  });

  test('findOverlappingExceptions returns exceptions in the range for owner', async () => {
    if (!dbReachable) return;
    const overlapping = await repo.findOverlappingExceptions(
      OWNER,
      day('2031-03-01T00:00:00Z'),
      day('2031-03-10T00:00:00Z'),
    );
    expect(overlapping.length).toBeGreaterThanOrEqual(2);
    expect(overlapping.every((e) => e.owner === OWNER)).toBe(true);
  });

  // --- generateRecurrenceOccurrences (pure, no DB needed but gated for consistency) ---

  function mkException(over: Partial<ScheduleException>): ScheduleException {
    return {
      id: randomUUID(),
      organizationId: EVENT_ORG,
      event: EVENT,
      owner: OWNER,
      context: CONTEXT,
      timezone: EVENT_TZ,
      startDatetime: new Date('2031-04-01T09:00:00Z'),
      endDatetime: new Date('2031-04-01T10:00:00Z'),
      reason: 'r',
      recurring: false,
      recurrencePattern: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      createdBy: OWNER,
      updatedBy: OWNER,
      ...over,
    } as ScheduleException;
  }

  test('generateRecurrenceOccurrences: non-recurring returns single occurrence', async () => {
    if (!dbReachable) return;
    const occ = repo.generateRecurrenceOccurrences(mkException({}), new Date('2031-05-01T00:00:00Z'));
    expect(occ.length).toBe(1);
    expect(occ[0]!.start.toISOString()).toBe('2031-04-01T09:00:00.000Z');
  });

  test('generateRecurrenceOccurrences: daily up to untilDate', async () => {
    if (!dbReachable) return;
    const occ = repo.generateRecurrenceOccurrences(
      mkException({ recurring: true, recurrencePattern: { type: 'daily', interval: 1 } }),
      new Date('2031-04-05T09:00:00Z'),
    );
    // Apr 1,2,3,4,5 → 5 occurrences
    expect(occ.length).toBe(5);
    expect(occ[1]!.start.toISOString()).toBe('2031-04-02T09:00:00.000Z');
    // duration preserved (1h)
    expect(occ[0]!.end.getTime() - occ[0]!.start.getTime()).toBe(3600000);
  });

  test('generateRecurrenceOccurrences: weekly with interval', async () => {
    if (!dbReachable) return;
    const occ = repo.generateRecurrenceOccurrences(
      mkException({ recurring: true, recurrencePattern: { type: 'weekly', interval: 2 } }),
      new Date('2031-05-01T00:00:00Z'),
    );
    expect(occ.length).toBeGreaterThanOrEqual(2);
    // +2 weeks = 14 days
    expect(occ[1]!.start.toISOString()).toBe('2031-04-15T09:00:00.000Z');
  });

  test('generateRecurrenceOccurrences: monthly', async () => {
    if (!dbReachable) return;
    const occ = repo.generateRecurrenceOccurrences(
      mkException({ recurring: true, recurrencePattern: { type: 'monthly' } }),
      new Date('2031-07-15T00:00:00Z'),
    );
    expect(occ.length).toBe(4); // Apr, May, Jun, Jul
    expect(occ[1]!.start.toISOString()).toBe('2031-05-01T09:00:00.000Z');
  });

  test('generateRecurrenceOccurrences: maxOccurrences cap', async () => {
    if (!dbReachable) return;
    const occ = repo.generateRecurrenceOccurrences(
      mkException({ recurring: true, recurrencePattern: { type: 'daily', maxOccurrences: 3 } }),
      new Date('2032-01-01T00:00:00Z'),
    );
    expect(occ.length).toBe(3);
  });

  test('generateRecurrenceOccurrences: pattern.endDate overrides untilDate', async () => {
    if (!dbReachable) return;
    const occ = repo.generateRecurrenceOccurrences(
      mkException({
        recurring: true,
        recurrencePattern: { type: 'daily', endDate: '2031-04-03T09:00:00Z' },
      }),
      new Date('2032-01-01T00:00:00Z'), // far future untilDate — endDate should cap it
    );
    expect(occ.length).toBe(3); // Apr 1,2,3
  });
});

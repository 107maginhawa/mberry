/**
 * Real-PG integration suite for BookingEventRepository — the ONLY booking repo
 * with no real-PG coverage before Wave-2 (it had a fully-mocked unit test only).
 *
 * Uses the shared createScratch harness (isolated schema, FKs dropped) over
 * ['booking_event','person']. Proves the smart-default writes, the DB CHECK
 * constraints, change-detection, the raw jsonb/FTS where-clause operators, and
 * the owner inner-join — all against real Postgres. Skips when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { BookingEventRepository } from './bookingEvent.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let repo: BookingEventRepository;

const ORG = 'ed8e3a96-8126-4341-be42-e6eb7940c562';

/** Seed a person row (owner). person needs only id + first_name (rest nullable). */
async function seedPerson(id: string, name = 'Owner'): Promise<string> {
  await H.scopedPool.query(`INSERT INTO "${H.schema}".person (id, first_name) VALUES ($1,$2)`, [id, name]);
  return id;
}

function dailyConfigs(startTime = '09:00', endTime = '12:00') {
  return { mon: { enabled: true, timeBlocks: [{ startTime, endTime }] } } as never;
}

async function readEventRow(id: string) {
  const { rows } = await H.scopedPool.query(
    `SELECT timezone, location_types, max_booking_days, min_booking_minutes, status,
            daily_configs, effective_from, organization_id
       FROM "${H.schema}".booking_event WHERE id = $1`, [id]);
  return rows[0];
}

beforeAll(async () => {
  H = await createScratch(['booking_event', 'person']);
  if (H.dbReachable) repo = new BookingEventRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

describe('BookingEventRepository.createWithSmartDefaults — real-PG', () => {
  test('applies smart defaults and round-trips dailyConfigs JSONB with block defaults', async () => {
    if (!H.dbReachable) return;
    const owner = await seedPerson(crypto.randomUUID());
    const ev = await repo.createWithSmartDefaults(owner, { title: 'Consults', dailyConfigs: dailyConfigs() }, ORG);

    expect(ev.timezone).toBe('America/New_York');
    expect(ev.locationTypes).toEqual(['video', 'phone', 'in-person']);
    expect(ev.maxBookingDays).toBe(30);
    expect(ev.minBookingMinutes).toBe(1440);
    expect(ev.status).toBe('active');

    const row = await readEventRow(ev.id);
    expect(row.timezone).toBe('America/New_York');
    expect(row.max_booking_days).toBe(30);
    expect(row.organization_id).toBe(ORG);
    // Block defaults applied by processAndValidateDailyConfigs.
    const block = row.daily_configs.mon.timeBlocks[0];
    expect(block.slotDuration).toBe(30);
    expect(block.bufferTime).toBe(0);
    expect(block.startTime).toBe('09:00');
  });

  test('DB CHECK: effective_to < effective_from violates booking_events_effective_date_order', async () => {
    if (!H.dbReachable) return;
    const owner = await seedPerson(crypto.randomUUID());
    let code: string | undefined;
    try {
      await repo.createWithSmartDefaults(owner, {
        title: 'Bad dates', dailyConfigs: dailyConfigs(),
        effectiveFrom: new Date('2030-06-01T00:00:00Z') as never,
        effectiveTo: new Date('2030-01-01T00:00:00Z') as never,
      }, ORG);
    } catch (e) { code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code; }
    expect(code).toBe('23514');
  });

  test('DB CHECK: max_booking_days > 365 violates booking_events_max_booking_days_check', async () => {
    if (!H.dbReachable) return;
    const owner = await seedPerson(crypto.randomUUID());
    let code: string | undefined;
    try {
      await repo.createWithSmartDefaults(owner, { title: 'Too far', dailyConfigs: dailyConfigs(), maxBookingDays: 400 }, ORG);
    } catch (e) { code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code; }
    expect(code).toBe('23514');
  });
});

describe('BookingEventRepository.updateWithChangeDetection — real-PG', () => {
  test('changing dailyConfigs flags slot regeneration + persists the new JSONB', async () => {
    if (!H.dbReachable) return;
    const owner = await seedPerson(crypto.randomUUID());
    const ev = await repo.createWithSmartDefaults(owner, { title: 'Reconfig', dailyConfigs: dailyConfigs('09:00', '10:00') }, ORG);

    const res = await repo.updateWithChangeDetection(ev.id, { dailyConfigs: dailyConfigs('13:00', '17:00') });
    expect(res.requiresSlotRegeneration).toBe(true);
    expect(res.changes).toContain('dailyConfigs');

    const row = await readEventRow(ev.id);
    expect(row.daily_configs.mon.timeBlocks[0].startTime).toBe('13:00');
  });

  test('changing only the title does NOT flag slot regeneration', async () => {
    if (!H.dbReachable) return;
    const owner = await seedPerson(crypto.randomUUID());
    const ev = await repo.createWithSmartDefaults(owner, { title: 'Original', dailyConfigs: dailyConfigs() }, ORG);

    const res = await repo.updateWithChangeDetection(ev.id, { title: 'Renamed' });
    expect(res.requiresSlotRegeneration).toBe(false);
    expect(res.changes).toEqual(['title']);
  });
});

describe('BookingEventRepository.buildWhereConditions (via findMany) — real-PG raw operators', () => {
  test('q full-text search matches title/description; status/owner/context filters; tag ?| and ?&', async () => {
    if (!H.dbReachable) return;
    const ownerA = await seedPerson(crypto.randomUUID(), 'A');
    const ownerB = await seedPerson(crypto.randomUUID(), 'B');

    const root = await repo.createWithSmartDefaults(ownerA, {
      title: 'Endodontics Masterclass', description: 'root canal therapy',
      tags: ['dental', 'advanced'] as never, context: 'ctx-1', dailyConfigs: dailyConfigs(),
    }, ORG);
    await repo.createWithSmartDefaults(ownerB, {
      title: 'Yoga Session', tags: ['wellness'] as never, status: 'paused', dailyConfigs: dailyConfigs(),
    }, ORG);

    // FTS on title (websearch_to_tsquery binds against real PG).
    const fts = await repo.findMany({ q: 'endodontics' });
    expect(fts.map((e) => e.id)).toContain(root.id);
    expect(fts).toHaveLength(1);

    // owner filter.
    expect((await repo.findMany({ owner: ownerA })).map((e) => e.id)).toEqual([root.id]);
    // status filter.
    expect((await repo.findMany({ status: 'paused' })).every((e) => e.status === 'paused')).toBe(true);
    // context filter.
    expect((await repo.findMany({ context: 'ctx-1' })).map((e) => e.id)).toEqual([root.id]);

    // tag ?| (any) and ?& (all) jsonb operators.
    const anyTag = await repo.findMany({ tagsOr: ['advanced', 'wellness'] });
    expect(anyTag.length).toBe(2);
    const allTags = await repo.findMany({ tagsAnd: ['dental', 'advanced'] });
    expect(allTags.map((e) => e.id)).toEqual([root.id]);
    expect(await repo.findMany({ tagsAnd: ['dental', 'nonexistent'] })).toHaveLength(0);
  });
});

describe('BookingEventRepository owner inner-join — real-PG', () => {
  test('findOneByIdWithOwner merges the owner person; null when the event is missing', async () => {
    if (!H.dbReachable) return;
    const owner = await seedPerson(crypto.randomUUID(), 'Dr Reyes');
    const ev = await repo.createWithSmartDefaults(owner, { title: 'Joined', dailyConfigs: dailyConfigs() }, ORG);

    const withOwner = await repo.findOneByIdWithOwner(ev.id) as { id: string; owner: { id: string; firstName: string } } | null;
    expect(withOwner?.id).toBe(ev.id);
    expect(withOwner?.owner.id).toBe(owner);
    expect(withOwner?.owner.firstName).toBe('Dr Reyes');

    expect(await repo.findOneByIdWithOwner(crypto.randomUUID())).toBeNull();
  });

  test('findManyWithOwner returns each event merged with its owner', async () => {
    if (!H.dbReachable) return;
    const owner = await seedPerson(crypto.randomUUID(), 'Solo');
    await repo.createWithSmartDefaults(owner, { title: 'M1', dailyConfigs: dailyConfigs() }, ORG);

    const rows = await repo.findManyWithOwner({ owner }) as { owner: { id: string } }[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.owner.id === owner)).toBe(true);
  });
});

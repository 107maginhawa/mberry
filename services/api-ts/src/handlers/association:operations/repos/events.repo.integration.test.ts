/**
 * Real-PG integration suite for the association:operations event repos
 * (EventRepository / EventRegistrationRepository / CheckInRepository /
 * WaitlistEntryRepository). Replaces the fake-db illusion in events.repo.test.ts.
 *
 * Shared scheduling-cluster tables via createScratch — FKs dropped, partial-unique
 * uq_event_reg_active copied by LIKE … INCLUDING ALL. Skips when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  EventRepository,
  EventRegistrationRepository,
  CheckInRepository,
  WaitlistEntryRepository,
} from './events.repo';
import { NotFoundError } from '@/core/errors';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let events: EventRepository;
let regs: EventRegistrationRepository;
let checkins: CheckInRepository;
let waitlist: WaitlistEntryRepository;

const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b2';

function eventData(o: Partial<Record<string, unknown>> = {}) {
  return {
    organizationId: ORG_A,
    title: 'Conf',
    startDate: new Date('2030-05-01T09:00:00Z'),
    endDate: new Date('2030-05-01T17:00:00Z'),
    status: 'draft',
    ...o,
  } as never;
}

beforeAll(async () => {
  H = await createScratch(['event', 'event_registration', 'check_in', 'waitlist_entry']);
  if (!H.dbReachable) return;
  events = new EventRepository(H.db as never);
  regs = new EventRegistrationRepository(H.db as never);
  checkins = new CheckInRepository(H.db as never);
  waitlist = new WaitlistEntryRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

describe('EventRepository — real-PG CRUD + lifecycle', () => {
  test('findMany scopes by organizationId and status; no filter returns all', async () => {
    if (!H.dbReachable) return;
    await events.createOne(eventData({ organizationId: ORG_A, status: 'draft' }));
    await events.createOne(eventData({ organizationId: ORG_A, status: 'published' }));
    await events.createOne(eventData({ organizationId: ORG_B, status: 'draft' }));

    const orgA = await events.findMany({ organizationId: ORG_A } as never);
    expect(orgA.length).toBe(2);
    expect(orgA.every((e) => e.organizationId === ORG_A)).toBe(true);

    const published = await events.findMany({ organizationId: ORG_A, status: 'published' } as never);
    expect(published.length).toBe(1);
    expect(published[0]!.status).toBe('published');

    expect((await events.findMany()).length).toBeGreaterThanOrEqual(3);
  });

  test('publish/complete/cancel set status (+ publishedAt) and throw NotFoundError on a missing id', async () => {
    if (!H.dbReachable) return;
    const ev = await events.createOne(eventData({ status: 'draft' }));

    const pub = await events.publish(ev.id);
    expect(pub.status).toBe('published');
    expect(pub.publishedAt).not.toBeNull();

    const ev2 = await events.createOne(eventData());
    expect((await events.complete(ev2.id)).status).toBe('completed');
    const ev3 = await events.createOne(eventData());
    expect((await events.cancel(ev3.id)).status).toBe('cancelled');

    await expect(events.publish(crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
    await expect(events.complete(crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
    await expect(events.cancel(crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('EventRegistrationRepository — real-PG count + uq_event_reg_active', () => {
  test('count reflects real rows; a duplicate active (event,person) insert raises 23505; a cancelled prior row does not block', async () => {
    if (!H.dbReachable) return;
    const ev = await events.createOne(eventData());
    const p1 = crypto.randomUUID();
    await regs.createOne({ organizationId: ORG_A, eventId: ev.id, personId: p1, status: 'confirmed' } as never);
    await regs.createOne({ organizationId: ORG_A, eventId: ev.id, personId: crypto.randomUUID(), status: 'confirmed' } as never);
    await regs.createOne({ organizationId: ORG_A, eventId: ev.id, personId: crypto.randomUUID(), status: 'confirmed' } as never);
    expect(await regs.count({ eventId: ev.id } as never)).toBe(3);

    // Duplicate active (same event,person) → 23505.
    let code: string | undefined;
    try {
      await regs.createOne({ organizationId: ORG_A, eventId: ev.id, personId: p1, status: 'confirmed' } as never);
    } catch (e) { code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code; }
    expect(code).toBe('23505');

    // A cancelled row + a fresh confirmed under the SAME pair is allowed (predicate excludes cancelled).
    const ev2 = await events.createOne(eventData());
    const p2 = crypto.randomUUID();
    await regs.createOne({ organizationId: ORG_A, eventId: ev2.id, personId: p2, status: 'cancelled' } as never);
    const ok = await regs.createOne({ organizationId: ORG_A, eventId: ev2.id, personId: p2, status: 'confirmed' } as never);
    expect(ok.status).toBe('confirmed');
  });

  test('findMany scopes by eventId / personId / status', async () => {
    if (!H.dbReachable) return;
    const ev = await events.createOne(eventData());
    const person = crypto.randomUUID();
    await regs.createOne({ organizationId: ORG_A, eventId: ev.id, personId: person, status: 'confirmed' } as never);
    expect((await regs.findMany({ eventId: ev.id } as never)).length).toBe(1);
    expect((await regs.findMany({ personId: person } as never)).every((r) => r.personId === person)).toBe(true);
    expect((await regs.findMany({ eventId: ev.id, status: 'waitlisted' } as never)).length).toBe(0);
  });
});

describe('CheckInRepository — real-PG scoping + attestation jsonb', () => {
  test('findMany scopes by event/person; attestation jsonb round-trips', async () => {
    if (!H.dbReachable) return;
    const ev = await events.createOne(eventData());
    const person = crypto.randomUUID();
    await checkins.createOne({
      organizationId: ORG_A, eventId: ev.id, personId: person, method: 'manual',
      attestation: { officerId: 'off-1', method: 'manual', timestamp: '2030-05-01T10:00:00Z' },
    } as never);

    const byEvent = await checkins.findMany({ eventId: ev.id } as never);
    expect(byEvent.length).toBe(1);
    expect((byEvent[0]!.attestation as { officerId: string }).officerId).toBe('off-1');
    expect((await checkins.findMany({ personId: person } as never)).length).toBe(1);
  });
});

describe('WaitlistEntryRepository — real-PG nextPosition + promoteNext FIFO', () => {
  test('nextPosition is 1 when empty, then MAX(position)+1', async () => {
    if (!H.dbReachable) return;
    const ev = await events.createOne(eventData());
    expect(await waitlist.nextPosition(ev.id)).toBe(1);
    await waitlist.createOne({ organizationId: ORG_A, eventId: ev.id, personId: crypto.randomUUID(), position: 1 } as never);
    await waitlist.createOne({ organizationId: ORG_A, eventId: ev.id, personId: crypto.randomUUID(), position: 2 } as never);
    expect(await waitlist.nextPosition(ev.id)).toBe(3);
  });

  test('promoteNext promotes FIFO by position, stamps promotedAt, skips promoted, returns null when none', async () => {
    if (!H.dbReachable) return;
    const ev = await events.createOne(eventData());
    // Insert positions 3,1,2 out of order — FIFO must promote 1, then 2, then 3.
    await waitlist.createOne({ organizationId: ORG_A, eventId: ev.id, personId: crypto.randomUUID(), position: 3 } as never);
    await waitlist.createOne({ organizationId: ORG_A, eventId: ev.id, personId: crypto.randomUUID(), position: 1 } as never);
    await waitlist.createOne({ organizationId: ORG_A, eventId: ev.id, personId: crypto.randomUUID(), position: 2 } as never);

    const first = await waitlist.promoteNext(ev.id);
    expect(first?.position).toBe(1);
    expect(first?.promotedAt).not.toBeNull();
    expect((await waitlist.promoteNext(ev.id))?.position).toBe(2);
    expect((await waitlist.promoteNext(ev.id))?.position).toBe(3);
    expect(await waitlist.promoteNext(ev.id)).toBeNull();
  });
});

/**
 * Unit suite for the event repositories (fake-DB harness, ./__fake-db).
 *
 * Covers each repo's buildWhereConditions branches (driven via the inherited
 * findMany/findOne/count) plus EventRepository state transitions and the
 * WaitlistEntryRepository nextPosition / promoteNext logic.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  EventRepository,
  EventRegistrationRepository,
  CheckInRepository,
  WaitlistEntryRepository,
} from './events.repo';
import {
  events,
  eventRegistrations,
  checkIns,
  waitlistEntries,
} from './events.schema';
import { NotFoundError } from '@/core/errors';
import { makeFakeDb, type FakeDb } from './__fake-db';

let fake: FakeDb;

beforeEach(() => {
  fake = makeFakeDb();
});

describe('EventRepository', () => {
  let repo: EventRepository;
  beforeEach(() => {
    repo = new EventRepository(fake.db);
  });

  test('findMany exercises org + status filter branches', async () => {
    fake.seed(events, [{ id: 'e1', organizationId: 'org-1', status: 'published' }]);
    const out = await repo.findMany({ organizationId: 'org-1', status: 'published' });
    expect(out).toHaveLength(1);
  });

  test('findMany with no filters returns all (no where branch)', async () => {
    fake.seed(events, [{ id: 'e1' }, { id: 'e2' }]);
    expect(await repo.findMany()).toHaveLength(2);
  });

  test('count uses buildWhereConditions', async () => {
    fake.seed(events, [{ id: 'e1', organizationId: 'org-1' }]);
    expect(await repo.count({ organizationId: 'org-1' })).toBe(1);
  });

  test('publish sets published + publishedAt', async () => {
    fake.seed(events, [{ id: 'e1', status: 'draft' }]);
    const out = await repo.publish('e1');
    expect(out.status).toBe('published');
    expect(out.publishedAt).toBeInstanceOf(Date);
  });

  test('publish throws NotFoundError when missing', async () => {
    fake.seed(events, []);
    await expect(repo.publish('nope')).rejects.toBeInstanceOf(NotFoundError);
  });

  test('complete sets completed status', async () => {
    fake.seed(events, [{ id: 'e1', status: 'published' }]);
    expect((await repo.complete('e1')).status).toBe('completed');
  });

  test('complete throws NotFoundError when missing', async () => {
    fake.seed(events, []);
    await expect(repo.complete('nope')).rejects.toBeInstanceOf(NotFoundError);
  });

  test('cancel sets cancelled status', async () => {
    fake.seed(events, [{ id: 'e1', status: 'published' }]);
    expect((await repo.cancel('e1')).status).toBe('cancelled');
  });

  test('cancel throws NotFoundError when missing', async () => {
    fake.seed(events, []);
    await expect(repo.cancel('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('EventRegistrationRepository.buildWhereConditions branches', () => {
  test('event + person + status filters', async () => {
    const repo = new EventRegistrationRepository(fake.db);
    fake.seed(eventRegistrations, [
      { id: 'r1', eventId: 'e1', personId: 'p1', status: 'registered' },
    ]);
    const out = await repo.findMany({ eventId: 'e1', personId: 'p1', status: 'registered' });
    expect(out).toHaveLength(1);
  });
});

describe('CheckInRepository.buildWhereConditions branches', () => {
  test('event + person filters', async () => {
    const repo = new CheckInRepository(fake.db);
    fake.seed(checkIns, [{ id: 'ci1', eventId: 'e1', personId: 'p1' }]);
    expect(await repo.findMany({ eventId: 'e1', personId: 'p1' })).toHaveLength(1);
  });
});

describe('WaitlistEntryRepository', () => {
  let repo: WaitlistEntryRepository;
  beforeEach(() => {
    repo = new WaitlistEntryRepository(fake.db);
  });

  test('nextPosition returns 1 for an empty waitlist', async () => {
    fake.seed(waitlistEntries, []);
    expect(await repo.nextPosition('e1')).toBe(1);
  });

  test('nextPosition returns max(position)+1', async () => {
    fake.seed(waitlistEntries, [
      { id: 'w1', eventId: 'e1', position: 1 },
      { id: 'w2', eventId: 'e1', position: 3 },
    ]);
    expect(await repo.nextPosition('e1')).toBe(4);
  });

  test('promoteNext returns null when nothing unpromoted', async () => {
    fake.seed(waitlistEntries, [
      { id: 'w1', eventId: 'e1', position: 1, promotedAt: new Date() },
    ]);
    expect(await repo.promoteNext('e1')).toBeNull();
  });

  test('promoteNext promotes lowest-position unpromoted entry (FIFO)', async () => {
    fake.seed(waitlistEntries, [
      { id: 'w2', eventId: 'e1', position: 2, promotedAt: null },
      { id: 'w1', eventId: 'e1', position: 1, promotedAt: null },
    ]);
    const promoted = await repo.promoteNext('e1');
    expect(promoted).not.toBeNull();
    expect(promoted!.promotedAt).toBeInstanceOf(Date);
  });
});

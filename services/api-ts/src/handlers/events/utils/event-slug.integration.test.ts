/**
 * Real-PG integration test for ensureUniqueEventSlug (event-slug.ts).
 *
 * The collision loop (`while (await repo.findBySlug(candidate))`) is only
 * meaningful against real persisted rows + the real UNIQUE slug index — a mock
 * findBySlug can't prove the loop terminates correctly or that the suffix walk
 * has no off-by-one / infinite-loop. This suite seeds real rows and drives the
 * loop against them.
 *
 * generateEventSlug is a pure string transform already covered by event-slug.test.ts
 * — here we only characterize the unique-base passthrough, not re-test the transform.
 *
 * Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { ensureUniqueEventSlug, generateEventSlug } from './event-slug';
import { EventsRepository } from '../repos/events.repo';
import { type ScratchDb } from '@/test-utils/pg-scratch';
import { createSchedulingScratch, seedEvent } from '@/test-utils/scheduling-fixtures';

let H: ScratchDb;
let repo: EventsRepository;

beforeAll(async () => {
  H = await createSchedulingScratch();
  if (H.dbReachable) repo = new EventsRepository(H.db as never);
});

afterAll(async () => {
  await H?.teardown();
});

describe('ensureUniqueEventSlug — collision loop against the real UNIQUE slug index', () => {
  test('appends -2 when the base slug is already taken', async () => {
    if (!H.dbReachable) return;
    await seedEvent(H, { eventSlug: 'conf-a' });
    expect(await ensureUniqueEventSlug('conf-a', repo)).toBe('conf-a-2');
  });

  test('walks to -3 when base AND -2 are both taken (loop iterates twice, no off-by-one)', async () => {
    if (!H.dbReachable) return;
    await seedEvent(H, { eventSlug: 'conf-b' });
    await seedEvent(H, { eventSlug: 'conf-b-2' });
    expect(await ensureUniqueEventSlug('conf-b', repo)).toBe('conf-b-3');
  });

  test('returns the base slug unchanged when nothing collides', async () => {
    if (!H.dbReachable) return;
    const base = generateEventSlug('Brand New Unseen Title');
    expect(base).toBe('brand-new-unseen-title');
    expect(await ensureUniqueEventSlug(base, repo)).toBe('brand-new-unseen-title');
  });
});

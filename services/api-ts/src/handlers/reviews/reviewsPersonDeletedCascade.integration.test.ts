/**
 * Inter-module integration: person.deleted → reviews cascade (real bus + real PG).
 *
 * Wires the REAL `registerDomainEventConsumers` against a scratch-schema
 * Postgres, emits `person.deleted` through the REAL `domainEvents` bus, and
 * asserts the REAL persisted `review` rows. The reviews consumer
 * (core/domain-event-consumers.ts:1814-1828) runs two writes, both `await`ed
 * inside `emit`'s Promise.allSettled, so the rows are settled by the time
 * `emit()` resolves — no polling needed.
 *
 * Both review→person FKs are `ON DELETE RESTRICT`, so this cascade MUST run
 * before any hard person delete: the authored rows are hard-deleted and the
 * subject reference is nulled out (so the restrict-FK no longer points at the
 * removed person). This proves that ordering + the restrict-safety at SQL level,
 * which the prior mock-only tests could never exercise.
 *
 * Mirrors booking/booking-notification-consumer.integration.test.ts. Skips when
 * the DB is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  createContentScratch,
  CONTENT_ORG,
  seedReview,
} from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { registerDomainEventConsumers } from '@/core/domain-event-consumers';
import { domainEvents } from '@/core/domain-events';
import { SYSTEM_USER_ID } from '@/core/constants';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as never;

// registerDomainEventConsumers requires a membershipRepo dep; the reviews
// person.deleted consumer never calls it.
const membershipRepo = {
  async findByPersonAndOrg() { return null; },
  async updateOneById() { return undefined; },
} as never;

/** Read one review row back by id (raw, scratch-scoped). */
async function readReview(id: string): Promise<Record<string, unknown> | undefined> {
  const { rows } = await H.scopedPool.query(
    `SELECT id, reviewer_id, reviewed_entity_id, updated_by
       FROM "${H.schema}".review WHERE id = $1`,
    [id],
  );
  return rows[0];
}

async function countReviews(id: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS c FROM "${H.schema}".review WHERE id = $1`,
    [id],
  );
  return rows[0]!.c as number;
}

beforeAll(async () => {
  H = await createContentScratch();
  if (!H.dbReachable) return;
  // Clean slate on the global bus, then register the real consumers against our db.
  domainEvents.reset();
  registerDomainEventConsumers({ membershipRepo, db: H.db as never }, noopLogger);
});

afterAll(async () => {
  domainEvents.reset();
  await H?.teardown();
});

describe('person.deleted → reviews cascade (real bus, real-PG)', () => {
  test('authored review is hard-deleted; subject reference nulled; unrelated untouched', async () => {
    if (!H.dbReachable) return;

    const deletedPerson = crypto.randomUUID();
    const otherReviewer = crypto.randomUUID();

    // (a) review AUTHORED BY the deleted person → must be hard-deleted.
    const authored = await seedReview(H, {
      reviewerId: deletedPerson,
      organizationId: CONTENT_ORG,
      reviewType: 'nps',
      npsScore: 7,
    });

    // (b) review where deleted person is the SUBJECT (different reviewer) →
    //     retained, reviewed_entity_id nulled, updated_by = SYSTEM_USER_ID.
    const subject = await seedReview(H, {
      reviewerId: otherReviewer,
      reviewedEntity: deletedPerson,
      organizationId: CONTENT_ORG,
      reviewType: 'peer',
      npsScore: 8,
      updatedBy: otherReviewer, // pre-cascade updated_by — must change to SYSTEM after.
    });

    // (c) completely unrelated review → untouched.
    const unrelated = await seedReview(H, {
      reviewerId: crypto.randomUUID(),
      reviewedEntity: crypto.randomUUID(),
      organizationId: CONTENT_ORG,
      reviewType: 'nps',
      npsScore: 9,
      updatedBy: crypto.randomUUID(),
    });
    const unrelatedBefore = await readReview(unrelated.id);

    await domainEvents.emit('person.deleted', { personId: deletedPerson } as never);

    // (a) hard-deleted.
    expect(await countReviews(authored.id)).toBe(0);

    // (b) retained, subject ref nulled, stamped by SYSTEM.
    const subjectAfter = await readReview(subject.id);
    expect(subjectAfter).toBeDefined();
    expect(subjectAfter!['reviewed_entity_id']).toBeNull();
    expect(subjectAfter!['updated_by']).toBe(SYSTEM_USER_ID);
    // reviewer of the subject row is preserved (it is NOT the deleted person).
    expect(subjectAfter!['reviewer_id']).toBe(otherReviewer);

    // (c) untouched — every column identical to pre-cascade.
    const unrelatedAfter = await readReview(unrelated.id);
    expect(unrelatedAfter).toEqual(unrelatedBefore);
  });

  test('a row where the deleted person is BOTH reviewer and subject is deleted by the reviewer branch (not left dangling)', async () => {
    if (!H.dbReachable) return;

    const both = crypto.randomUUID();
    const r = await seedReview(H, {
      reviewerId: both,
      reviewedEntity: both,
      organizationId: CONTENT_ORG,
      reviewType: 'self',
      npsScore: 6,
    });

    await domainEvents.emit('person.deleted', { personId: both } as never);

    // The DELETE-by-reviewer branch wins → row is gone, not merely anonymized.
    // (If ordering were reversed and the UPDATE hit a restrict-FK conflict on a
    //  still-present authored row, this would surface as a retained row.)
    expect(await countReviews(r.id)).toBe(0);
  });

  test('emitting for a personId with zero reviews → no error, nothing changes', async () => {
    if (!H.dbReachable) return;

    // Pre-existing rows from earlier tests stay put; seed one more sentinel.
    const sentinel = await seedReview(H, {
      reviewerId: crypto.randomUUID(),
      organizationId: CONTENT_ORG,
      reviewType: 'nps',
      npsScore: 4,
    });
    const sentinelBefore = await readReview(sentinel.id);

    const { rows: beforeRows } = await H.scopedPool.query(
      `SELECT count(*)::int AS c FROM "${H.schema}".review`,
    );
    const totalBefore = beforeRows[0]!.c as number;

    await domainEvents.emit('person.deleted', { personId: crypto.randomUUID() } as never);

    const { rows: afterRows } = await H.scopedPool.query(
      `SELECT count(*)::int AS c FROM "${H.schema}".review`,
    );
    expect(afterRows[0]!.c as number).toBe(totalBefore);
    expect(await readReview(sentinel.id)).toEqual(sentinelBefore);
  });
});

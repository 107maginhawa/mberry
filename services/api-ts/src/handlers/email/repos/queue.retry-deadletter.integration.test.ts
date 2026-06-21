/**
 * Real-PG integration: EmailQueue retry / dead-letter selection + exponential
 * backoff lifecycle — the heart of delivery reliability.
 *
 * `getPendingEmails` and `markAsFailed`/`calculateNextRetryTime` are the SQL that
 * decides whether a failed email gets retried, when, and when it is finally
 * dead-lettered. Today these paths are exercised only against scripted mocks
 * (`queue.repo.test.ts` is a class-level mock illusion) — the actual SQL
 * predicate (`cancelledAt IS NULL AND ((pending AND scheduled-due) OR (failed AND
 * next_retry_at<=now AND attempts<=3))`) and the persisted backoff timestamps
 * (+5m/+30m/+2h → null) have never been proven against real Postgres. This suite
 * drives the REAL `EmailQueueRepository` against a `createScratch` copy of the
 * live `email_queue` table and asserts the EXACT selected id-set + the real
 * persisted `next_retry_at` deltas.
 *
 * ── OFF-BY-ONE CHARACTERIZATION (comment vs code — DO NOT silently fix) ──
 * `queue.repo.ts:153`'s inline comment says "attempts < 3", but the predicate is
 * `lte(emailQueue.attempts, 3)` (i.e. <= 3). A `failed` row with `attempts=3` AND
 * a non-null, due `next_retry_at` IS therefore re-selected → a 4th send attempt
 * is admitted before dead-lettering. The EFFECTIVE max is 4 send attempts, not 3.
 * This is internally consistent and terminates correctly: `markAsFailed` with the
 * row's current `attempts=3` writes `attempts=4` and `next_retry_at=NULL`
 * (`calculateNextRetryTime(3)` returns null → NULL next_retry_at is never
 * `<= now`, so the row is excluded = dead-lettered). We CHARACTERIZE this
 * contract as-is (test `admits a 4th attempt …` below). If product wants a hard
 * 3-attempt cap, that is a one-line `lt(attempts,3)` change flagged as a
 * productDecision — NOT made here.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { EmailQueueRepository } from './queue.repo';

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['email_queue']);
});

afterAll(async () => {
  await H?.teardown();
});

const ORG = '00000000-0000-4000-8000-0000000000a1';

/**
 * Raw INSERT a queue row with explicit lifecycle columns. Only the NOT-NULL cols
 * without a DB default (recipient_email, variables) must always be supplied;
 * status/priority/attempts/email_category carry DB defaults but we set them
 * explicitly to make each row's selection-relevant state unambiguous.
 */
async function insertRow(opts: {
  status: string;
  attempts?: number;
  priority?: number;
  nextRetryAt?: Date | null;
  scheduledAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt?: Date;
  recipient?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".email_queue
       (id, organization_id, recipient_email, variables, status, priority,
        attempts, next_retry_at, scheduled_at, cancelled_at, created_at)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      ORG,
      opts.recipient ?? `r-${id}@x.test`,
      '{}',
      opts.status,
      opts.priority ?? 5,
      opts.attempts ?? 0,
      opts.nextRetryAt ?? null,
      opts.scheduledAt ?? null,
      opts.cancelledAt ?? null,
      opts.createdAt ?? new Date(),
    ],
  );
  return id;
}

async function readRow(id: string) {
  const { rows } = await H.scopedPool.query(
    `SELECT status, attempts, next_retry_at, last_error FROM "${H.schema}".email_queue WHERE id=$1`,
    [id],
  );
  return rows[0];
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

describe('EmailQueueRepository.getPendingEmails — retry/dead-letter selection (real PG)', () => {
  test('selects exactly the due-and-eligible id set, excludes future/dead-lettered/cancelled', async () => {
    if (!H.dbReachable) return;
    const repo = new EmailQueueRepository(H.db as never);
    const now = Date.now();

    // failed, retry due (now-1min, attempts=1) → SELECTED
    const dueRetry = await insertRow({
      status: 'failed',
      attempts: 1,
      nextRetryAt: new Date(now - 1 * MIN),
    });
    // failed, retry not yet due (now+1h) → NOT selected
    const futureRetry = await insertRow({
      status: 'failed',
      attempts: 1,
      nextRetryAt: new Date(now + 1 * HOUR),
    });
    // failed, dead-lettered (next_retry_at NULL, attempts=4) → NOT selected
    const deadLettered = await insertRow({
      status: 'failed',
      attempts: 4,
      nextRetryAt: null,
    });
    // pending, no schedule → SELECTED
    const pendingNow = await insertRow({ status: 'pending', scheduledAt: null });
    // pending, scheduled in the future → NOT selected
    const pendingFuture = await insertRow({
      status: 'pending',
      scheduledAt: new Date(now + 1 * HOUR),
    });
    // pending, scheduled in the past → SELECTED
    const pendingPast = await insertRow({
      status: 'pending',
      scheduledAt: new Date(now - 1 * MIN),
    });
    // cancelled outer-guard: pending status but non-null cancelled_at → NEVER selected
    const cancelledRow = await insertRow({
      status: 'pending',
      scheduledAt: null,
      cancelledAt: new Date(now - 1 * MIN),
    });

    const selectedIds = (await repo.getPendingEmails(50)).map((r) => r.id);

    expect(selectedIds).toContain(dueRetry);
    expect(selectedIds).toContain(pendingNow);
    expect(selectedIds).toContain(pendingPast);

    expect(selectedIds).not.toContain(futureRetry);
    expect(selectedIds).not.toContain(deadLettered);
    expect(selectedIds).not.toContain(pendingFuture);
    expect(selectedIds).not.toContain(cancelledRow);
  });

  test('orders by priority asc, then created_at asc (tie-break)', async () => {
    if (!H.dbReachable) return;
    const repo = new EmailQueueRepository(H.db as never);
    const base = Date.now();

    // Two due rows, priority 5 then 1 — priority 1 must come first.
    const lowPriority = await insertRow({ status: 'pending', priority: 5, createdAt: new Date(base) });
    const highPriority = await insertRow({ status: 'pending', priority: 1, createdAt: new Date(base) });
    // Tie-break: two priority-3 rows, older created_at first.
    const olderTie = await insertRow({ status: 'pending', priority: 3, createdAt: new Date(base - 10 * MIN) });
    const newerTie = await insertRow({ status: 'pending', priority: 3, createdAt: new Date(base - 5 * MIN) });

    const ordered = (await repo.getPendingEmails(50)).map((r) => r.id);

    // priority 1 before priority 3 before priority 5
    expect(ordered.indexOf(highPriority)).toBeLessThan(ordered.indexOf(olderTie));
    expect(ordered.indexOf(olderTie)).toBeLessThan(ordered.indexOf(lowPriority));
    // within priority 3, older created_at first
    expect(ordered.indexOf(olderTie)).toBeLessThan(ordered.indexOf(newerTie));
  });

  test('CHARACTERIZATION: a failed row with attempts=3 + a due next_retry_at IS selected (effective max = 4 attempts, comment overstates the 3-cap)', async () => {
    if (!H.dbReachable) return;
    const repo = new EmailQueueRepository(H.db as never);
    const fourthAttempt = await insertRow({
      status: 'failed',
      attempts: 3,
      nextRetryAt: new Date(Date.now() - 1 * MIN),
    });

    const selectedIds = (await repo.getPendingEmails(50)).map((r) => r.id);
    // lte(attempts, 3) admits attempts=3 → a 4th send attempt is permitted.
    expect(selectedIds).toContain(fourthAttempt);
  });
});

describe('EmailQueueRepository.markAsFailed — exponential backoff lifecycle (real PG)', () => {
  // Tolerance window for timestamp assertions (handler computes Date.now() at call).
  const TOL = 30 * 1000;

  function within(actual: Date, expectedMs: number) {
    const delta = Math.abs(actual.getTime() - expectedMs);
    return delta <= TOL;
  }

  test('attempts=0 → status=failed, attempts=1, next_retry_at ≈ now+5min, last_error persisted', async () => {
    if (!H.dbReachable) return;
    const repo = new EmailQueueRepository(H.db as never);
    const id = await insertRow({ status: 'processing', attempts: 0 });

    const before = Date.now();
    await repo.markAsFailed(id, 'boom', 0);

    const row = await readRow(id);
    expect(row.status).toBe('failed');
    expect(row.attempts).toBe(1);
    expect(row.last_error).toBe('boom');
    expect(row.next_retry_at).not.toBeNull();
    expect(within(new Date(row.next_retry_at), before + 5 * MIN)).toBe(true);
  });

  test('attempts=1 → next_retry_at ≈ now+30min', async () => {
    if (!H.dbReachable) return;
    const repo = new EmailQueueRepository(H.db as never);
    const id = await insertRow({ status: 'processing', attempts: 1 });

    const before = Date.now();
    await repo.markAsFailed(id, 'boom', 1);

    const row = await readRow(id);
    expect(row.attempts).toBe(2);
    expect(within(new Date(row.next_retry_at), before + 30 * MIN)).toBe(true);
  });

  test('attempts=2 → next_retry_at ≈ now+2h', async () => {
    if (!H.dbReachable) return;
    const repo = new EmailQueueRepository(H.db as never);
    const id = await insertRow({ status: 'processing', attempts: 2 });

    const before = Date.now();
    await repo.markAsFailed(id, 'boom', 2);

    const row = await readRow(id);
    expect(row.attempts).toBe(3);
    expect(within(new Date(row.next_retry_at), before + 2 * HOUR)).toBe(true);
  });

  test('attempts=3 → dead-letter: next_retry_at IS NULL, attempts=4', async () => {
    if (!H.dbReachable) return;
    const repo = new EmailQueueRepository(H.db as never);
    const id = await insertRow({ status: 'processing', attempts: 3 });

    await repo.markAsFailed(id, 'boom', 3);

    const row = await readRow(id);
    expect(row.attempts).toBe(4);
    expect(row.next_retry_at).toBeNull();

    // And the dead-lettered row is then excluded from getPendingEmails.
    const selectedIds = (await repo.getPendingEmails(50)).map((r) => r.id);
    expect(selectedIds).not.toContain(id);
  });
});

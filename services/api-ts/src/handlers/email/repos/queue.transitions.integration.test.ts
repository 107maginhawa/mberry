/**
 * Real-PG integration tests for EmailQueueRepository status-transition machine
 * (B3 email Slice S3, axis BR).
 *
 * Replaces the mock illusion in queue.repo.test.ts for the lifecycle methods by
 * exercising markAsProcessing / markAsSent / markAsFailed / cancelEmail /
 * retryEmail against REAL Postgres rows in an isolated scratch schema. Asserts
 * are persisted column values (read back via scopedPool) and the exact error
 * class thrown — never 200-only / toBeDefined.
 *
 * Contract proven here (against EMAIL_QUEUE_VALID_TRANSITIONS at
 * src/utils/status-transitions.ts:21-27):
 *   pending → [processing, cancelled]
 *   processing → [sent, failed]
 *   sent → []            (terminal)
 *   failed → [pending, processing]
 *   cancelled → []       (terminal)
 *
 * - Happy path: pending → processing (last_attempt_at set) → sent
 *   (sent_at / provider / provider_message_id persisted).
 * - Illegal transitions throw ConflictError AND leave the row UNCHANGED
 *   (read-back status identical): sent→processing, cancelled→sent, pending→sent.
 * - cancelEmail valid only from pending; from processing/sent → ConflictError,
 *   row unchanged.
 * - retryEmail: failed(attempts<3) → pending + next_retry_at NULL + last_error
 *   NULL; failed(attempts>=3) → BusinessLogicError MAX_RETRIES_EXCEEDED, row
 *   unchanged; sent → ConflictError (not a valid failed→pending source).
 * - missing id → NotFoundError for retry/cancel/markAsSent.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { EmailQueueRepository } from './queue.repo';
import { ConflictError, NotFoundError, BusinessLogicError } from '@/core/errors';

const ORG = '00000000-0000-4000-8000-0000000003a1';
const CANCEL_USER = '00000000-0000-4000-8000-0000000003b2';

let H: ScratchDb;
let repo: EmailQueueRepository;

beforeAll(async () => {
  H = await createScratch(['email_queue']);
  if (H.dbReachable) {
    repo = new EmailQueueRepository(H.db as never);
  }
});

afterAll(async () => {
  await H?.teardown();
});

/**
 * Seed an email_queue row directly (bypassing the repo) with an explicit
 * status/attempts so we can drive a transition from any starting state.
 */
async function seedRow(opts: {
  status: string;
  attempts?: number;
  nextRetryAt?: Date | null;
  lastError?: string | null;
}): Promise<string> {
  const id = crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".email_queue
       (id, organization_id, recipient_email, variables, template_tags, status, attempts, next_retry_at, last_error)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9)`,
    [
      id,
      ORG,
      'recipient@x.test',
      JSON.stringify({}),
      JSON.stringify(['welcome']),
      opts.status,
      opts.attempts ?? 0,
      opts.nextRetryAt ?? null,
      opts.lastError ?? null,
    ],
  );
  return id;
}

async function readRow(id: string) {
  const { rows } = await H.scopedPool.query(
    `SELECT status, attempts, next_retry_at, last_error, sent_at, provider,
            provider_message_id, last_attempt_at, cancelled_at, cancelled_by,
            cancellation_reason
       FROM "${H.schema}".email_queue WHERE id = $1`,
    [id],
  );
  return rows[0];
}

describe('EmailQueueRepository status-transition machine (real-PG)', () => {
  test('happy path: pending → processing → sent persists provider fields', async () => {
    if (!H.dbReachable) return;
    const id = await seedRow({ status: 'pending' });

    await repo.markAsProcessing(id);
    let row = await readRow(id);
    expect(row.status).toBe('processing');
    expect(row.last_attempt_at).not.toBeNull();

    await repo.markAsSent(id, 'smtp', 'msg-1');
    row = await readRow(id);
    expect(row.status).toBe('sent');
    expect(row.sent_at).not.toBeNull();
    expect(row.provider).toBe('smtp');
    expect(row.provider_message_id).toBe('msg-1');
  });

  test('illegal sent → processing throws ConflictError, row unchanged', async () => {
    if (!H.dbReachable) return;
    const id = await seedRow({ status: 'sent' });
    let err: unknown;
    try {
      await repo.markAsProcessing(id);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConflictError);
    const row = await readRow(id);
    expect(row.status).toBe('sent'); // unchanged
  });

  test('illegal cancelled → sent throws ConflictError, row unchanged', async () => {
    if (!H.dbReachable) return;
    const id = await seedRow({ status: 'cancelled' });
    let err: unknown;
    try {
      await repo.markAsSent(id, 'smtp', 'msg-x');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConflictError);
    const row = await readRow(id);
    expect(row.status).toBe('cancelled'); // unchanged
    expect(row.sent_at).toBeNull();
    expect(row.provider).toBeNull();
  });

  test('illegal pending → sent (must pass through processing) throws ConflictError, row unchanged', async () => {
    if (!H.dbReachable) return;
    const id = await seedRow({ status: 'pending' });
    let err: unknown;
    try {
      await repo.markAsSent(id, 'smtp', 'msg-y');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConflictError);
    const row = await readRow(id);
    expect(row.status).toBe('pending'); // unchanged
    expect(row.sent_at).toBeNull();
  });

  test('cancelEmail from pending persists cancelled fields', async () => {
    if (!H.dbReachable) return;
    const id = await seedRow({ status: 'pending' });
    await repo.cancelEmail(id, CANCEL_USER, 'no longer needed');
    const row = await readRow(id);
    expect(row.status).toBe('cancelled');
    expect(row.cancelled_at).not.toBeNull();
    expect(row.cancelled_by).toBe(CANCEL_USER);
    expect(row.cancellation_reason).toBe('no longer needed');
  });

  test('cancelEmail from processing throws ConflictError, row unchanged', async () => {
    if (!H.dbReachable) return;
    const id = await seedRow({ status: 'processing' });
    let err: unknown;
    try {
      await repo.cancelEmail(id, 'user-1', 'too late');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConflictError);
    const row = await readRow(id);
    expect(row.status).toBe('processing'); // unchanged
    expect(row.cancelled_at).toBeNull();
  });

  test('cancelEmail from sent throws ConflictError, row unchanged', async () => {
    if (!H.dbReachable) return;
    const id = await seedRow({ status: 'sent' });
    let err: unknown;
    try {
      await repo.cancelEmail(id, 'user-1', 'too late');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConflictError);
    const row = await readRow(id);
    expect(row.status).toBe('sent'); // unchanged
    expect(row.cancelled_at).toBeNull();
  });

  test('retryEmail from failed (attempts<3) → pending + next_retry_at NULL + last_error NULL', async () => {
    if (!H.dbReachable) return;
    const id = await seedRow({
      status: 'failed',
      attempts: 2,
      nextRetryAt: new Date(Date.now() + 60_000),
      lastError: 'boom',
    });
    await repo.retryEmail(id);
    const row = await readRow(id);
    expect(row.status).toBe('pending');
    expect(row.next_retry_at).toBeNull();
    expect(row.last_error).toBeNull();
  });

  test('retryEmail from failed (attempts>=3) → BusinessLogicError MAX_RETRIES_EXCEEDED, row unchanged', async () => {
    if (!H.dbReachable) return;
    const id = await seedRow({
      status: 'failed',
      attempts: 3,
      nextRetryAt: new Date(Date.now() + 60_000),
      lastError: 'boom',
    });
    let err: unknown;
    try {
      await repo.retryEmail(id);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('MAX_RETRIES_EXCEEDED');
    const row = await readRow(id);
    expect(row.status).toBe('failed'); // unchanged
    expect(row.attempts).toBe(3);
    expect(row.last_error).toBe('boom');
  });

  test('retryEmail from sent → ConflictError (not a valid failed→pending source), row unchanged', async () => {
    if (!H.dbReachable) return;
    const id = await seedRow({ status: 'sent' });
    let err: unknown;
    try {
      await repo.retryEmail(id);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConflictError);
    const row = await readRow(id);
    expect(row.status).toBe('sent'); // unchanged
  });

  test('retryEmail / cancelEmail / markAsSent on missing id → NotFoundError', async () => {
    if (!H.dbReachable) return;
    const missing = crypto.randomUUID();

    let retryErr: unknown;
    try {
      await repo.retryEmail(missing);
    } catch (e) {
      retryErr = e;
    }
    expect(retryErr).toBeInstanceOf(NotFoundError);

    let cancelErr: unknown;
    try {
      await repo.cancelEmail(missing, 'user-1', 'x');
    } catch (e) {
      cancelErr = e;
    }
    expect(cancelErr).toBeInstanceOf(NotFoundError);

    let sentErr: unknown;
    try {
      await repo.markAsSent(missing, 'smtp', 'msg-z');
    } catch (e) {
      sentErr = e;
    }
    expect(sentErr).toBeInstanceOf(NotFoundError);
  });
});

/**
 * Webhook Retry Processor Tests (slice 009, M6-R8, GAP-009)
 *
 * TDD RED: tests written first, then implementation.
 *
 * Covers:
 * - M6-R8: duplicate webhook returns 200 (idempotency key)
 * - Retry count tracking with exponential backoff (1m, 5m, 15m, 1h)
 * - Dead letter after max retries
 * - Successful retry transitions payment to completed
 * - Circuit breaker prevents retry storms
 * - Permission: system-initiated auto-retries, manual retry by treasurer
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import {
  processWebhookRetry,
  handleIncomingWebhook,
  computeNextRetryAt,
  MAX_RETRIES,
  BACKOFF_SCHEDULE_MS,
  type WebhookRetryResult,
  type WebhookEvent,
} from './webhookRetryProcessor';
// Factory N/A: job handler test — scheduler/queue assertions, no domain entity construction

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockLogger() {
  return {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  };
}

/**
 * Build a sequenced mock DB for webhook retry queries.
 */
function buildSequencedDb(responses: any[], insertSpy?: (val: any) => void, updateSpy?: (table: any, where: any, values: any) => void) {
  let callIdx = 0;
  return {
    select: (..._args: any[]) => ({
      from: (_table: any) => {
        const idx = callIdx++;
        const resp = idx < responses.length ? responses[idx] : [];
        if (Array.isArray(resp)) {
          const result = Promise.resolve(resp);
          (result as any).where = () => Promise.resolve(resp);
          return result;
        }
        return resp;
      },
    }),
    insert: (_table: any) => ({
      values: (val: any) => {
        insertSpy?.(val);
        return {
          returning: () => Promise.resolve([{ id: 'webhook-log-new', ...val }]),
          onConflictDoNothing: () => ({
            returning: () => Promise.resolve([{ id: 'webhook-log-new', ...val }]),
          }),
        };
      },
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: (where: any) => {
          updateSpy?.(table, where, values);
          return Promise.resolve([{ id: 'updated', ...values }]);
        },
      }),
    }),
    transaction: async (fn: (tx: any) => Promise<any>) => {
      const txDb = buildSequencedDb(responses.slice(callIdx), insertSpy, updateSpy);
      return fn(txDb);
    },
  };
}

function whereResponse(data: any[]) {
  return {
    where: () => Promise.resolve(data),
  };
}

// ---------------------------------------------------------------------------
// Constants validation
// ---------------------------------------------------------------------------

describe('webhook retry constants', () => {
  test('MAX_RETRIES is 4 (1m, 5m, 15m, 1h)', () => {
    expect(MAX_RETRIES).toBe(4);
  });

  test('BACKOFF_SCHEDULE_MS follows 1m, 5m, 15m, 1h', () => {
    expect(BACKOFF_SCHEDULE_MS).toEqual([
      60_000,       // 1 minute
      300_000,      // 5 minutes
      900_000,      // 15 minutes
      3_600_000,    // 1 hour
    ]);
  });
});

// ---------------------------------------------------------------------------
// computeNextRetryAt
// ---------------------------------------------------------------------------

describe('computeNextRetryAt', () => {
  test('retry 0 -> next retry in 1 minute', () => {
    const now = new Date('2026-01-15T10:00:00Z');
    const next = computeNextRetryAt(0, now);
    expect(next.toISOString()).toBe('2026-01-15T10:01:00.000Z');
  });

  test('retry 1 -> next retry in 5 minutes', () => {
    const now = new Date('2026-01-15T10:00:00Z');
    const next = computeNextRetryAt(1, now);
    expect(next.toISOString()).toBe('2026-01-15T10:05:00.000Z');
  });

  test('retry 2 -> next retry in 15 minutes', () => {
    const now = new Date('2026-01-15T10:00:00Z');
    const next = computeNextRetryAt(2, now);
    expect(next.toISOString()).toBe('2026-01-15T10:15:00.000Z');
  });

  test('retry 3 -> next retry in 1 hour', () => {
    const now = new Date('2026-01-15T10:00:00Z');
    const next = computeNextRetryAt(3, now);
    expect(next.toISOString()).toBe('2026-01-15T11:00:00.000Z');
  });

  test('retry >= MAX_RETRIES returns null (dead letter)', () => {
    const now = new Date('2026-01-15T10:00:00Z');
    const next = computeNextRetryAt(4, now);
    expect(next).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// M6-R8: Idempotency — duplicate webhook returns 200
// ---------------------------------------------------------------------------

describe('[M6-R8] handleIncomingWebhook — idempotency', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  test('duplicate webhook with same idempotency key returns 200 + skipped', async () => {
    const existingLog = {
      id: 'log-1',
      idempotencyKey: 'wh_evt_abc123',
      status: 'completed',
      retryCount: 0,
    };

    const db = buildSequencedDb([
      whereResponse([existingLog]), // existing log found by idempotency key
    ]);

    const event: WebhookEvent = {
      idempotencyKey: 'wh_evt_abc123',
      provider: 'paymongo',
      eventType: 'payment.paid',
      payload: { paymentId: 'pay-1', amount: 5000 },
      organizationId: 'org-1',
    };

    const result = await handleIncomingWebhook({ db: db as any, logger: mockLogger, event });

    expect(result.status).toBe(200);
    expect(result.action).toBe('skipped');
  });

  test('new webhook creates log entry and processes', async () => {
    const insertedValues: any[] = [];

    const db = buildSequencedDb([
      whereResponse([]), // no existing log — new webhook
    ], (val) => insertedValues.push(val));

    const event: WebhookEvent = {
      idempotencyKey: 'wh_evt_new123',
      provider: 'paymongo',
      eventType: 'payment.paid',
      payload: { paymentId: 'pay-1', amount: 5000 },
      organizationId: 'org-1',
    };

    const result = await handleIncomingWebhook({
      db: db as any,
      logger: mockLogger,
      event,
      processPayment: async () => ({ success: true }),
    });

    expect(result.status).toBe(200);
    expect(result.action).toBe('processed');
    expect(insertedValues.length).toBeGreaterThanOrEqual(1);
    expect(insertedValues[0].idempotencyKey).toBe('wh_evt_new123');
  });

  test('failed processing queues for retry', async () => {
    const insertedValues: any[] = [];
    const updatedValues: any[] = [];

    const db = buildSequencedDb([
      whereResponse([]), // no existing log
    ], (val) => insertedValues.push(val), (_t, _w, v) => updatedValues.push(v));

    const event: WebhookEvent = {
      idempotencyKey: 'wh_evt_fail1',
      provider: 'paymongo',
      eventType: 'payment.paid',
      payload: { paymentId: 'pay-1', amount: 5000 },
      organizationId: 'org-1',
    };

    const result = await handleIncomingWebhook({
      db: db as any,
      logger: mockLogger,
      event,
      processPayment: async () => { throw new Error('Gateway timeout'); },
    });

    expect(result.status).toBe(200); // Always 200 to prevent provider retries
    expect(result.action).toBe('queued_for_retry');
  });
});

// ---------------------------------------------------------------------------
// Retry count tracking
// ---------------------------------------------------------------------------

describe('processWebhookRetry — retry tracking', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  test('increments retry count on each attempt', async () => {
    const updatedValues: any[] = [];

    const pendingRetry = {
      id: 'log-1',
      idempotencyKey: 'wh_evt_retry1',
      provider: 'paymongo',
      eventType: 'payment.paid',
      payload: { paymentId: 'pay-1', amount: 5000 },
      organizationId: 'org-1',
      status: 'pending_retry',
      retryCount: 1,
      nextRetryAt: new Date('2026-01-15T09:00:00Z'), // past due
    };

    const db = buildSequencedDb([
      whereResponse([pendingRetry]), // pending retries
    ], undefined, (_t, _w, v) => updatedValues.push(v));

    await processWebhookRetry({
      db: db as any,
      logger: mockLogger,
      now: new Date('2026-01-15T10:00:00Z'),
      processPayment: async () => { throw new Error('Still failing'); },
    });

    expect(updatedValues.length).toBeGreaterThanOrEqual(1);
    expect(updatedValues[0].retryCount).toBe(2);
  });

  test('successful retry transitions to completed', async () => {
    const updatedValues: any[] = [];

    const pendingRetry = {
      id: 'log-1',
      idempotencyKey: 'wh_evt_success',
      provider: 'paymongo',
      eventType: 'payment.paid',
      payload: { paymentId: 'pay-1', amount: 5000 },
      organizationId: 'org-1',
      status: 'pending_retry',
      retryCount: 2,
      nextRetryAt: new Date('2026-01-15T09:00:00Z'),
    };

    const db = buildSequencedDb([
      whereResponse([pendingRetry]),
    ], undefined, (_t, _w, v) => updatedValues.push(v));

    const result = await processWebhookRetry({
      db: db as any,
      logger: mockLogger,
      now: new Date('2026-01-15T10:00:00Z'),
      processPayment: async () => ({ success: true }),
    });

    expect(result.succeeded).toBe(1);
    const completedUpdate = updatedValues.find(v => v.status === 'completed');
    expect(completedUpdate).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Dead letter after max retries
// ---------------------------------------------------------------------------

describe('processWebhookRetry — dead letter', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  test('moves to dead_letter after MAX_RETRIES failures', async () => {
    const updatedValues: any[] = [];

    const maxedRetry = {
      id: 'log-1',
      idempotencyKey: 'wh_evt_maxed',
      provider: 'paymongo',
      eventType: 'payment.paid',
      payload: { paymentId: 'pay-1', amount: 5000 },
      organizationId: 'org-1',
      status: 'pending_retry',
      retryCount: 3, // next attempt will be retry #4 = MAX_RETRIES
      nextRetryAt: new Date('2026-01-15T09:00:00Z'),
    };

    const db = buildSequencedDb([
      whereResponse([maxedRetry]),
    ], undefined, (_t, _w, v) => updatedValues.push(v));

    const result = await processWebhookRetry({
      db: db as any,
      logger: mockLogger,
      now: new Date('2026-01-15T10:00:00Z'),
      processPayment: async () => { throw new Error('Persistent failure'); },
    });

    expect(result.deadLettered).toBe(1);
    const dlUpdate = updatedValues.find(v => v.status === 'dead_letter');
    expect(dlUpdate).toBeDefined();
  });

  test('does not retry events already in dead_letter', async () => {
    const db = buildSequencedDb([
      whereResponse([]), // no pending_retry events (dead_letter excluded)
    ]);

    const result = await processWebhookRetry({
      db: db as any,
      logger: mockLogger,
      now: new Date('2026-01-15T10:00:00Z'),
      processPayment: async () => ({ success: true }),
    });

    expect(result.succeeded).toBe(0);
    expect(result.retried).toBe(0);
    expect(result.deadLettered).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

describe('processWebhookRetry — circuit breaker', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  test('stops processing when consecutive failures exceed threshold', async () => {
    const pendingRetries = Array.from({ length: 10 }, (_, i) => ({
      id: `log-${i}`,
      idempotencyKey: `wh_evt_cb_${i}`,
      provider: 'paymongo',
      eventType: 'payment.paid',
      payload: { paymentId: `pay-${i}`, amount: 5000 },
      organizationId: 'org-1',
      status: 'pending_retry',
      retryCount: 1,
      nextRetryAt: new Date('2026-01-15T09:00:00Z'),
    }));

    const updatedValues: any[] = [];
    const db = buildSequencedDb([
      whereResponse(pendingRetries),
    ], undefined, (_t, _w, v) => updatedValues.push(v));

    let callCount = 0;
    const result = await processWebhookRetry({
      db: db as any,
      logger: mockLogger,
      now: new Date('2026-01-15T10:00:00Z'),
      processPayment: async () => {
        callCount++;
        throw new Error('Provider down');
      },
      circuitBreakerThreshold: 5,
    });

    // Should have stopped after 5 consecutive failures
    expect(callCount).toBeLessThanOrEqual(5);
    expect(result.circuitBroken).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Permission: manual retry by treasurer
// ---------------------------------------------------------------------------

describe('handleIncomingWebhook — manual retry permission', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  test('manual retry by treasurer resets dead_letter to pending_retry', async () => {
    const updatedValues: any[] = [];

    const deadLetterLog = {
      id: 'log-dl-1',
      idempotencyKey: 'wh_evt_dl1',
      provider: 'paymongo',
      eventType: 'payment.paid',
      payload: { paymentId: 'pay-1', amount: 5000 },
      organizationId: 'org-1',
      status: 'dead_letter',
      retryCount: 4,
      nextRetryAt: null,
    };

    const db = buildSequencedDb([
      whereResponse([deadLetterLog]),
    ], undefined, (_t, _w, v) => updatedValues.push(v));

    const result = await handleIncomingWebhook({
      db: db as any,
      logger: mockLogger,
      event: {
        idempotencyKey: 'wh_evt_dl1',
        provider: 'paymongo',
        eventType: 'payment.paid',
        payload: { paymentId: 'pay-1', amount: 5000 },
        organizationId: 'org-1',
      },
      manualRetry: true,
      actorRole: 'treasurer',
    });

    expect(result.action).toBe('manual_retry_queued');
    const resetUpdate = updatedValues.find(v => v.status === 'pending_retry');
    expect(resetUpdate).toBeDefined();
    expect(resetUpdate.retryCount).toBe(0); // reset count on manual retry
  });

  test('manual retry by non-treasurer is rejected', async () => {
    const db = buildSequencedDb([
      whereResponse([{
        id: 'log-dl-1',
        idempotencyKey: 'wh_evt_dl1',
        status: 'dead_letter',
        retryCount: 4,
      }]),
    ]);

    const result = await handleIncomingWebhook({
      db: db as any,
      logger: mockLogger,
      event: {
        idempotencyKey: 'wh_evt_dl1',
        provider: 'paymongo',
        eventType: 'payment.paid',
        payload: {},
        organizationId: 'org-1',
      },
      manualRetry: true,
      actorRole: 'member',
    });

    expect(result.status).toBe(403);
    expect(result.action).toBe('forbidden');
  });
});

// ---------------------------------------------------------------------------
// All attempts logged
// ---------------------------------------------------------------------------

describe('webhook retry — audit logging', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  test('each retry attempt logs with retry count and error', async () => {
    const pendingRetry = {
      id: 'log-1',
      idempotencyKey: 'wh_evt_audit',
      provider: 'paymongo',
      eventType: 'payment.paid',
      payload: { paymentId: 'pay-1', amount: 5000 },
      organizationId: 'org-1',
      status: 'pending_retry',
      retryCount: 2,
      nextRetryAt: new Date('2026-01-15T09:00:00Z'),
    };

    const db = buildSequencedDb([
      whereResponse([pendingRetry]),
    ], undefined, () => {});

    await processWebhookRetry({
      db: db as any,
      logger: mockLogger,
      now: new Date('2026-01-15T10:00:00Z'),
      processPayment: async () => { throw new Error('Timeout'); },
    });

    // Should log the retry attempt with context
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});

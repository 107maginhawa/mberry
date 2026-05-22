/**
 * Webhook Retry Processor (slice 009, M6-R8, GAP-009)
 *
 * Handles payment webhook failure retry with exponential backoff.
 * - Idempotency key prevents duplicate processing (M6-R8)
 * - Exponential backoff: 1m, 5m, 15m, 1h
 * - Dead letter after MAX_RETRIES
 * - Circuit breaker prevents retry storms
 * - Manual retry by treasurer only
 * - All attempts logged for audit
 */

import type { DatabaseInstance } from '@/core/database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum retry attempts before dead-lettering */
export const MAX_RETRIES = 4;

/** Backoff schedule in milliseconds: 1m, 5m, 15m, 1h */
export const BACKOFF_SCHEDULE_MS = [
  60_000,       // 1 minute
  300_000,      // 5 minutes
  900_000,      // 15 minutes
  3_600_000,    // 1 hour
] as const;

/** Default circuit breaker threshold */
const DEFAULT_CIRCUIT_BREAKER_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookEvent {
  idempotencyKey: string;
  provider: string;
  eventType: string;
  payload: Record<string, unknown>;
  organizationId: string;
}

export interface WebhookHandlerResult {
  status: number;
  action: 'skipped' | 'processed' | 'queued_for_retry' | 'manual_retry_queued' | 'forbidden';
}

export interface WebhookRetryResult {
  retried: number;
  succeeded: number;
  deadLettered: number;
  circuitBroken: boolean;
}

interface HandleWebhookContext {
  db: DatabaseInstance;
  logger: any;
  event: WebhookEvent;
  processPayment?: (payload: Record<string, unknown>) => Promise<{ success: boolean }>;
  manualRetry?: boolean;
  actorRole?: string;
}

interface ProcessRetryContext {
  db: DatabaseInstance;
  logger: any;
  now: Date;
  processPayment: (payload: Record<string, unknown>) => Promise<{ success: boolean }>;
  circuitBreakerThreshold?: number;
}

// ---------------------------------------------------------------------------
// Schema reference (uses webhookRetryLogs table from dues-payments.schema)
// Table: webhook_retry_log
// Columns: id, idempotency_key, provider, event_type, payload, organization_id,
//          status, retry_count, last_retry_at, next_retry_at, last_error,
//          created_at, updated_at
// ---------------------------------------------------------------------------

// Inline table references for the webhook_retry_log table.
// These map to the Drizzle schema defined in dues-payments.schema.ts.
import {
  webhookRetryLogs,
} from '../repos/dues-payments.schema';
import { eq, and, lte } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// computeNextRetryAt
// ---------------------------------------------------------------------------

/**
 * Compute the next retry timestamp based on current retry count.
 * Returns null if retries exhausted (dead letter).
 */
export function computeNextRetryAt(currentRetryCount: number, now: Date = new Date()): Date | null {
  if (currentRetryCount >= MAX_RETRIES) {
    return null;
  }

  const delayMs = BACKOFF_SCHEDULE_MS[currentRetryCount] ?? BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1]!;
  return new Date(now.getTime() + (delayMs ?? 3_600_000));
}

// ---------------------------------------------------------------------------
// handleIncomingWebhook
// ---------------------------------------------------------------------------

/**
 * Handle an incoming payment webhook event.
 * Implements M6-R8 idempotency: duplicate events return 200 + skipped.
 * Always returns 200 to the provider to prevent provider-side retries.
 */
export async function handleIncomingWebhook(ctx: HandleWebhookContext): Promise<WebhookHandlerResult> {
  const { db, logger, event, processPayment, manualRetry, actorRole } = ctx;

  try {
    // 1. Check idempotency — has this webhook been processed before?
    const existing = await db
      .select()
      .from(webhookRetryLogs)
      .where(eq(webhookRetryLogs.idempotencyKey, event.idempotencyKey));

    if (existing.length > 0) {
      const log = existing[0]!;

      // Manual retry flow — treasurer can reset dead-lettered events
      if (manualRetry) {
        // Permission check: only treasurer can manually retry
        if (actorRole !== 'treasurer' && actorRole !== 'admin') {
          logger.warn({
            msg: 'Manual retry rejected — insufficient role',
            idempotencyKey: event.idempotencyKey,
            actorRole,
          });
          return { status: 403, action: 'forbidden' };
        }

        // Reset dead_letter to pending_retry with count=0
        await db
          .update(webhookRetryLogs)
          .set({
            status: 'pending_retry',
            retryCount: 0,
            nextRetryAt: computeNextRetryAt(0),
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(webhookRetryLogs.id, log.id));

        logger.info({
          msg: 'Manual retry queued by treasurer',
          idempotencyKey: event.idempotencyKey,
          actorRole,
        });

        return { status: 200, action: 'manual_retry_queued' };
      }

      // Normal duplicate — skip
      logger.debug({
        msg: 'Duplicate webhook, skipping',
        idempotencyKey: event.idempotencyKey,
        existingStatus: log.status,
      });

      return { status: 200, action: 'skipped' };
    }

    // 2. Insert new webhook log entry
    await db
      .insert(webhookRetryLogs)
      .values({
        idempotencyKey: event.idempotencyKey,
        provider: event.provider,
        eventType: event.eventType,
        payload: event.payload,
        organizationId: event.organizationId,
        status: 'processing',
        retryCount: 0,
        nextRetryAt: null,
        lastError: null,
      });

    // 3. Attempt to process the payment
    if (processPayment) {
      try {
        await processPayment(event.payload);

        // Success — mark as completed
        await db
          .update(webhookRetryLogs)
          .set({
            status: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(webhookRetryLogs.idempotencyKey, event.idempotencyKey));

        logger.info({
          msg: 'Webhook processed successfully',
          idempotencyKey: event.idempotencyKey,
        });

        return { status: 200, action: 'processed' };
      } catch (processError) {
        // Processing failed — queue for retry
        const nextRetry = computeNextRetryAt(0);

        await db
          .update(webhookRetryLogs)
          .set({
            status: 'pending_retry',
            retryCount: 0,
            nextRetryAt: nextRetry,
            lastError: processError instanceof Error ? processError.message : String(processError),
            lastRetryAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(webhookRetryLogs.idempotencyKey, event.idempotencyKey));

        logger.warn({
          msg: 'Webhook processing failed, queued for retry',
          idempotencyKey: event.idempotencyKey,
          error: processError instanceof Error ? processError.message : String(processError),
          nextRetryAt: nextRetry?.toISOString(),
        });

        return { status: 200, action: 'queued_for_retry' };
      }
    }

    // No processPayment function — mark as completed (dry run)
    return { status: 200, action: 'processed' };
  } catch (error) {
    logger.error({
      msg: 'Webhook handler error',
      idempotencyKey: event.idempotencyKey,
      error,
    });
    // Always return 200 to prevent provider retries
    return { status: 200, action: 'queued_for_retry' };
  }
}

// ---------------------------------------------------------------------------
// processWebhookRetry — background job handler
// ---------------------------------------------------------------------------

/**
 * Process pending webhook retries.
 * Called by the job scheduler on an interval.
 * Implements circuit breaker to prevent retry storms.
 */
export async function processWebhookRetry(ctx: ProcessRetryContext): Promise<WebhookRetryResult> {
  const {
    db,
    logger,
    now,
    processPayment,
    circuitBreakerThreshold = DEFAULT_CIRCUIT_BREAKER_THRESHOLD,
  } = ctx;

  const result: WebhookRetryResult = {
    retried: 0,
    succeeded: 0,
    deadLettered: 0,
    circuitBroken: false,
  };

  try {
    // 1. Fetch all pending_retry events whose nextRetryAt has passed
    const pendingRetries = await db
      .select()
      .from(webhookRetryLogs)
      .where(
        and(
          eq(webhookRetryLogs.status, 'pending_retry'),
          lte(webhookRetryLogs.nextRetryAt, now),
        ),
      );

    if (pendingRetries.length === 0) {
      logger.debug({ msg: 'No pending webhook retries' });
      return result;
    }

    let consecutiveFailures = 0;

    for (const entry of pendingRetries) {
      // Circuit breaker check
      if (consecutiveFailures >= circuitBreakerThreshold) {
        result.circuitBroken = true;
        logger.error({
          msg: 'Circuit breaker tripped — stopping webhook retries',
          consecutiveFailures,
          threshold: circuitBreakerThreshold,
          remaining: pendingRetries.length - result.retried,
        });
        break;
      }

      result.retried++;
      const newRetryCount = entry.retryCount + 1;

      try {
        // Attempt to process the payment
        await processPayment(entry.payload as Record<string, unknown>);

        // Success — mark as completed
        await db
          .update(webhookRetryLogs)
          .set({
            status: 'completed',
            retryCount: newRetryCount,
            lastRetryAt: now,
            nextRetryAt: null,
            lastError: null,
            updatedAt: now,
          })
          .where(eq(webhookRetryLogs.id, entry.id));

        result.succeeded++;
        consecutiveFailures = 0; // Reset circuit breaker

        logger.info({
          msg: 'Webhook retry succeeded',
          idempotencyKey: entry.idempotencyKey,
          retryCount: newRetryCount,
        });
      } catch (retryError) {
        consecutiveFailures++;
        const errorMsg = retryError instanceof Error ? retryError.message : String(retryError);

        // Check if we've hit max retries
        if (newRetryCount >= MAX_RETRIES) {
          // Dead letter
          await db
            .update(webhookRetryLogs)
            .set({
              status: 'dead_letter',
              retryCount: newRetryCount,
              lastRetryAt: now,
              nextRetryAt: null,
              lastError: errorMsg,
              updatedAt: now,
            })
            .where(eq(webhookRetryLogs.id, entry.id));

          result.deadLettered++;

          logger.error({
            msg: 'Webhook retry exhausted — dead lettered',
            idempotencyKey: entry.idempotencyKey,
            retryCount: newRetryCount,
            lastError: errorMsg,
          });
        } else {
          // Schedule next retry
          const nextRetryAt = computeNextRetryAt(newRetryCount, now);

          await db
            .update(webhookRetryLogs)
            .set({
              status: 'pending_retry',
              retryCount: newRetryCount,
              lastRetryAt: now,
              nextRetryAt: nextRetryAt,
              lastError: errorMsg,
              updatedAt: now,
            })
            .where(eq(webhookRetryLogs.id, entry.id));

          logger.warn({
            msg: 'Webhook retry failed, scheduled next attempt',
            idempotencyKey: entry.idempotencyKey,
            retryCount: newRetryCount,
            nextRetryAt: nextRetryAt?.toISOString(),
            error: errorMsg,
          });
        }
      }
    }
  } catch (error) {
    logger.error({ msg: 'Webhook retry processor failed', error });
    throw error;
  }

  return result;
}

/**
 * AC-M01-005: Account lockout after 5 consecutive failed login attempts.
 *
 * In-memory sliding window tracks failed attempts per email.
 * After 5 failures the user.banned / user.banExpires fields are set
 * (15-minute lockout) and an audit event is logged.
 *
 * On successful login the counter is cleared automatically because
 * a new session is created (session.create.after hook).
 */

import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import { maskEmail } from '@/core/logger';
import * as schema from '@/generated/better-auth/schema';
import { eq } from 'drizzle-orm';
import { AuditRepository } from '@/handlers/audit/repos/audit.repo';

// --- Constants -----------------------------------------------------------

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_MS = 30 * 60 * 1000; // 30 min window for counting failures
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // prune stale entries every 5 min

// --- Types ---------------------------------------------------------------

interface FailedAttemptEntry {
  timestamps: number[];
}

// --- In-memory store -----------------------------------------------------

const failedAttempts = new Map<string, FailedAttemptEntry>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [key, entry] of failedAttempts) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) failedAttempts.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow process to exit even if timer is running
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// --- Public API ----------------------------------------------------------

/**
 * Record a failed login attempt for an email.
 * Returns the current count after recording.
 */
export function recordFailedAttempt(email: string): number {
  startCleanup();
  const normalised = email.toLowerCase();
  const now = Date.now();
  let entry = failedAttempts.get(normalised);
  if (!entry) {
    entry = { timestamps: [] };
    failedAttempts.set(normalised, entry);
  }
  // Prune old entries outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > now - WINDOW_MS);
  entry.timestamps.push(now);
  return entry.timestamps.length;
}

/**
 * Get the number of recent failed attempts for an email.
 */
export function getFailedAttemptCount(email: string): number {
  const entry = failedAttempts.get(email.toLowerCase());
  if (!entry) return 0;
  const cutoff = Date.now() - WINDOW_MS;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  return entry.timestamps.length;
}

/**
 * Clear failed attempts for an email (called on successful login).
 */
export function clearFailedAttempts(email: string): void {
  failedAttempts.delete(email.toLowerCase());
}

/**
 * Check if an email has reached the lockout threshold.
 */
export function isLockedOut(email: string): boolean {
  return getFailedAttemptCount(email) >= MAX_FAILED_ATTEMPTS;
}

/**
 * Apply lockout to a user in the database using Better-Auth's
 * banned / banExpires / banReason fields.
 */
export async function applyLockout(
  database: DatabaseInstance,
  email: string,
  logger?: Logger,
): Promise<void> {
  const banExpires = new Date(Date.now() + LOCKOUT_DURATION_MS);

  try {
    await database
      .update(schema.user)
      .set({
        banned: true,
        banReason: 'Account locked: too many failed login attempts',
        banExpires,
      })
      .where(eq(schema.user.email, email));

    logger?.warn({ email: maskEmail(email), banExpires }, 'AC-M01-005: Account locked after failed login attempts');

    // Audit log the lockout event
    try {
      const auditRepo = new AuditRepository(database, logger);
      await auditRepo.logEvent({
        eventType: 'security',
        category: 'security',
        action: 'update',
        outcome: 'success',
        userType: 'system',
        resourceType: 'user',
        resource: email,
        description: `Account locked for 15 minutes after ${MAX_FAILED_ATTEMPTS} failed login attempts`,
      });
    } catch (auditErr) {
      logger?.warn({ error: auditErr, email: maskEmail(email) }, 'Failed to audit lockout event');
    }
  } catch (err) {
    logger?.error({ error: err, email: maskEmail(email) }, 'Failed to apply account lockout');
  }
}

/**
 * Remove lockout ban from a user (called when ban expires and user retries,
 * or can be called manually by admin).
 */
export async function clearLockout(
  database: DatabaseInstance,
  email: string,
  logger?: Logger,
): Promise<void> {
  try {
    await database
      .update(schema.user)
      .set({
        banned: false,
        banReason: null,
        banExpires: null,
      })
      .where(eq(schema.user.email, email));

    clearFailedAttempts(email);
    logger?.info({ email: maskEmail(email) }, 'Account lockout cleared');
  } catch (err) {
    logger?.error({ error: err, email: maskEmail(email) }, 'Failed to clear account lockout');
  }
}

// --- Test helpers --------------------------------------------------------

/** Reset all in-memory state (test only). */
export function _resetForTest(): void {
  failedAttempts.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

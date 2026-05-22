/**
 * Per-org sliding-window rate limiter for bulk email sends.
 *
 * Designed for background job use — NOT HTTP middleware.
 * Uses an in-memory Map keyed by orgId. Memory is bounded by the number of
 * organizations that have sent bulk email in the current window (T-25-03).
 *
 * Usage:
 *   const limiter = new BulkRateLimiter({ limit: 100, windowMs: 60_000 });
 *   if (!limiter.canSend(orgId)) throw new Error('Rate limit exceeded');
 */

export interface BulkRateLimiterOptions {
  /** Maximum number of bulk emails per org per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

function getDefaultLimit(): number {
  const envVal = process.env['BULK_EMAIL_RATE_LIMIT'];
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 100;
}

export class BulkRateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  /** Per-org list of send timestamps (epoch ms) within the current window */
  private readonly sends = new Map<string, number[]>();

  constructor(options?: Partial<BulkRateLimiterOptions>) {
    this.limit = options?.limit ?? getDefaultLimit();
    this.windowMs = options?.windowMs ?? 60_000;
  }

  /**
   * Check whether the org can send a bulk email right now.
   * Records the timestamp if allowed.
   *
   * @param orgId - Organization ID
   * @returns true if the send is allowed within the current window
   */
  canSend(orgId: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Get or initialise the org's send log
    let timestamps = this.sends.get(orgId);
    if (!timestamps) {
      timestamps = [];
      this.sends.set(orgId, timestamps);
    }

    // Prune expired timestamps (sliding window)
    const active = timestamps.filter((ts) => ts > cutoff);

    if (active.length >= this.limit) {
      // Update pruned list but don't record a new send
      this.sends.set(orgId, active);
      return false;
    }

    // Record this send and allow
    active.push(now);
    this.sends.set(orgId, active);
    return true;
  }

  /**
   * Return the number of sends recorded for an org within the current window.
   * Useful for monitoring / logging.
   */
  getSendCount(orgId: string): number {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const timestamps = this.sends.get(orgId) ?? [];
    return timestamps.filter((ts) => ts > cutoff).length;
  }

  /**
   * Reset the send log for all orgs (useful in tests).
   */
  reset(): void {
    this.sends.clear();
  }
}

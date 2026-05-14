/**
 * Tests for BulkRateLimiter — per-org sliding window in-memory rate limiter
 */

import { describe, test, expect } from 'bun:test';
import { BulkRateLimiter } from './bulk-rate-limiter';

describe('BulkRateLimiter', () => {
  test('canSend returns true when under limit', () => {
    const limiter = new BulkRateLimiter({ limit: 5, windowMs: 60_000 });
    expect(limiter.canSend('org-1')).toBe(true);
  });

  test('canSend returns false after limit reached for same org', () => {
    const limiter = new BulkRateLimiter({ limit: 3, windowMs: 60_000 });

    expect(limiter.canSend('org-1')).toBe(true);  // 1
    expect(limiter.canSend('org-1')).toBe(true);  // 2
    expect(limiter.canSend('org-1')).toBe(true);  // 3 (at limit)
    expect(limiter.canSend('org-1')).toBe(false); // 4 (over limit)
  });

  test('canSend returns true for different org even if first org is at limit', () => {
    const limiter = new BulkRateLimiter({ limit: 2, windowMs: 60_000 });

    limiter.canSend('org-1');
    limiter.canSend('org-1');
    // org-1 is now at limit

    // org-2 should still be allowed
    expect(limiter.canSend('org-2')).toBe(true);
  });

  test('canSend allows sends after window expires (time-based sliding window)', async () => {
    // Use a very short window
    const limiter = new BulkRateLimiter({ limit: 2, windowMs: 50 });

    expect(limiter.canSend('org-1')).toBe(true);   // 1
    expect(limiter.canSend('org-1')).toBe(true);   // 2 (at limit)
    expect(limiter.canSend('org-1')).toBe(false);  // blocked

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should be allowed again now that timestamps have expired
    expect(limiter.canSend('org-1')).toBe(true);
  });
});

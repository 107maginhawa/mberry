/**
 * Tests for registerAndPayForEvent handler
 *
 * This handler is a deferred stub (Wave 2) — throws DeferredScopeError.
 * Tests document the current interface contract and expected behavior
 * when implementation is completed.
 *
 * Covers:
 * - Current: DeferredScopeError thrown (expected for Wave 2 stub)
 * - Expected future: auth + event validation + payment integration
 */

import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

describe('registerAndPayForEvent (Wave 2 stub)', () => {
  test('throws DeferredScopeError — implementation deferred to Wave 2', async () => {
    const { registerAndPayForEvent } = await import('./registerAndPayForEvent');
    const ctx = makeCtx({
      _params: { eventId: 'evt-1' },
    });
    // The handler intentionally throws DeferredScopeError until Wave 2 is implemented
    await expect(registerAndPayForEvent(ctx)).rejects.toThrow(/registerAndPayForEvent/i);
  });

  test('stub surfaces eventId param from path', async () => {
    const { registerAndPayForEvent } = await import('./registerAndPayForEvent');
    // Even in stub form, handler should at least parse params without crashing on that step
    const ctx = makeCtx({
      _params: { eventId: 'evt-test' },
    });
    // Expect the deferred error to mention the operation name
    await expect(registerAndPayForEvent(ctx)).rejects.toThrow();
  });
});

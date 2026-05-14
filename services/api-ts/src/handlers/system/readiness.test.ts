import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { readiness } from './readiness';

/**
 * readiness — GET /readyz
 * Public endpoint. Currently a stub (throws "Not implemented").
 * Tests document expected behavior for when implementation is added.
 */
describe('readiness', () => {
  test('is a public endpoint (no auth check)', async () => {
    // Public endpoint: no user, no session — should not throw auth error
    const ctx = makeCtx({
      user: null,
      session: null,
      _query: {},
    });

    // Handler throws "Not implemented" — that is the current stub behavior,
    // NOT an auth rejection. We test the throw is the stub error, not a 401.
    try {
      await readiness(ctx as any);
      // If it returns without throwing, that's also fine for a future impl
    } catch (err: any) {
      // Must be the stub error, not an auth error
      expect(err.message).toContain('Not implemented');
    }
  });

  test('throws Not implemented (stub handler)', async () => {
    const ctx = makeCtx({ _query: {} });
    await expect(readiness(ctx as any)).rejects.toThrow('Not implemented');
  });
});

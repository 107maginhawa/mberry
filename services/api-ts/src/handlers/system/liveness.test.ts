import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { liveness } from './liveness';

/**
 * liveness — GET /livez
 * Public endpoint. Currently a stub (throws "Not implemented").
 * Tests document expected behavior for when implementation is added.
 */
describe('liveness', () => {
  test('is a public endpoint (no auth check)', async () => {
    // Public endpoint: no user, no session — should not throw auth error
    const ctx = makeCtx({
      user: null,
      session: null,
      _query: {},
    });

    try {
      await liveness(ctx as any);
    } catch (err: any) {
      // Must be the stub error, not an auth error
      expect(err.message).toContain('Not implemented');
    }
  });

  test('throws Not implemented (stub handler)', async () => {
    const ctx = makeCtx({ _query: {} });
    await expect(liveness(ctx as any)).rejects.toThrow('Not implemented');
  });
});

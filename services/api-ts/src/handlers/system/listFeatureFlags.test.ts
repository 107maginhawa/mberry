import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { listFeatureFlags } from './listFeatureFlags';

/**
 * listFeatureFlags — GET /feature-flags/feature-flags
 * Public endpoint. Currently a stub (throws "Not implemented").
 * Tests document expected behavior for when implementation is added.
 */
describe('listFeatureFlags', () => {
  test('is a public endpoint (no auth check)', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
    });

    try {
      await listFeatureFlags(ctx as any);
    } catch (err: any) {
      // Must be the stub error, not an auth error
      expect(err.message).toContain('Not implemented');
    }
  });

  test('throws Not implemented (stub handler)', async () => {
    const ctx = makeCtx({});
    await expect(listFeatureFlags(ctx as any)).rejects.toThrow('Not implemented');
  });
});

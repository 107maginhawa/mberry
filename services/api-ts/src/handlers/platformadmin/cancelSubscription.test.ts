/**
 * cancelSubscription — characterization tests (AHA FIX-002 backfill)
 *
 * Path: PUT /admin/subscriptions/:id/cancel
 * Access: platformAdmin only. Requires a `reason`. Emits subscription.cancelled.
 */
import { describe, test, expect, spyOn, afterEach } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { cancelSubscription } from './cancelSubscription';
import { ValidationError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';

const FAKE_LOGGER = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => FAKE_LOGGER };
const ADMIN = { id: 'pa-1', userId: 'admin-1', role: 'super' };

function sub(overrides: Record<string, any> = {}) {
  return { id: 'sub-1', organizationId: 'org-1', status: 'active', ...overrides };
}

function makeDb(existing: any, capture?: { set?: any }) {
  return {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (existing ? [existing] : []) }) }) }),
    update: () => ({
      set: (data: any) => {
        if (capture) capture.set = data;
        return { where: () => ({ returning: async () => [{ ...existing, ...data }] }) };
      },
    }),
  };
}

describe('cancelSubscription (characterization)', () => {
  let emitSpy: ReturnType<typeof spyOn>;
  afterEach(() => { emitSpy?.mockRestore(); });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { id: 'sub-1' }, _body: { reason: 'x' } });
    const res = await cancelSubscription(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without platformAdmin', async () => {
    const ctx = makeCtx({ user: { id: 'user-1', role: 'member' }, _params: { id: 'sub-1' }, _body: { reason: 'x' } });
    const res = await cancelSubscription(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 404 when subscription not found', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _params: { id: 'nope' },
      _body: { reason: 'fraud' },
      database: makeDb(null),
      logger: FAKE_LOGGER,
    });
    const res = await cancelSubscription(ctx);
    expect(res.status).toBe(404);
  });

  test('returns 409 when already cancelled', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _params: { id: 'sub-1' },
      _body: { reason: 'dup' },
      database: makeDb(sub({ status: 'cancelled' })),
      logger: FAKE_LOGGER,
    });
    const res = await cancelSubscription(ctx);
    expect(res.status).toBe(409);
  });

  test('throws ValidationError when reason missing', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _params: { id: 'sub-1' },
      _body: {},
      database: makeDb(sub()),
      logger: FAKE_LOGGER,
    });
    await expect(cancelSubscription(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('cancels an active subscription and emits subscription.cancelled', async () => {
    emitSpy = spyOn(domainEvents, 'emit').mockResolvedValue(undefined as never);
    const capture: { set?: any } = {};
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _params: { id: 'sub-1' },
      _body: { reason: 'non-payment' },
      database: makeDb(sub(), capture),
      logger: FAKE_LOGGER,
    });
    const res = await cancelSubscription(ctx);
    expect(res.status).toBe(200);
    expect(capture.set?.status).toBe('cancelled');
    expect(capture.set?.cancelReason).toBe('non-payment');
    expect(emitSpy).toHaveBeenCalledWith('subscription.cancelled', expect.objectContaining({ subscriptionId: 'sub-1' }));
  });
});

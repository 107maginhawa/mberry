/**
 * reportBreach — characterization tests (AHA FIX-002 backfill)
 *
 * Path: POST /admin/breaches
 * Access: platformAdmin only. Computes a 72h NPC notification deadline from
 * discoveredAt (DPA 2012 / M3-R11). Emits breach.reported.
 */
import { describe, test, expect, spyOn, afterEach } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { reportBreach } from './reportBreach';
import { ValidationError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';

const FAKE_LOGGER = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => FAKE_LOGGER };
const ADMIN = { id: 'pa-1', userId: 'admin-1', role: 'super' };

function makeDb(capture?: { values?: any }) {
  return {
    insert: () => ({
      values: (v: any) => {
        if (capture) capture.values = v;
        return { returning: async () => [{ id: 'breach-1', ...v }] };
      },
    }),
  };
}

describe('reportBreach (characterization)', () => {
  let emitSpy: ReturnType<typeof spyOn>;
  afterEach(() => { emitSpy?.mockRestore(); });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _body: { discoveredAt: new Date().toISOString(), description: 'x' } });
    const res = await reportBreach(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without platformAdmin', async () => {
    const ctx = makeCtx({ user: { id: 'user-1', role: 'member' }, _body: { discoveredAt: new Date().toISOString(), description: 'x' } });
    const res = await reportBreach(ctx);
    expect(res.status).toBe(403);
  });

  test('throws ValidationError when discoveredAt is invalid', async () => {
    emitSpy = spyOn(domainEvents, 'emit').mockResolvedValue(undefined as never);
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _body: { discoveredAt: 'not-a-date', description: 'PII leak' },
      database: makeDb(),
      logger: FAKE_LOGGER,
    });
    await expect(reportBreach(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when discoveredAt is in the future', async () => {
    emitSpy = spyOn(domainEvents, 'emit').mockResolvedValue(undefined as never);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _body: { discoveredAt: future, description: 'PII leak' },
      database: makeDb(),
      logger: FAKE_LOGGER,
    });
    await expect(reportBreach(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('creates a breach with a 72h deadline and emits breach.reported', async () => {
    emitSpy = spyOn(domainEvents, 'emit').mockResolvedValue(undefined as never);
    const capture: { values?: any } = {};
    const discovered = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _body: { discoveredAt: discovered.toISOString(), description: 'Exposed member PII', affectedRecordsCount: 42 },
      database: makeDb(capture),
      logger: FAKE_LOGGER,
    });
    const res = await reportBreach(ctx);
    expect(res.status).toBe(201);
    const deadline = capture.values?.notificationDeadline as Date;
    const expected = discovered.getTime() + 72 * 60 * 60 * 1000;
    expect(Math.abs(deadline.getTime() - expected)).toBeLessThan(1000);
    expect(emitSpy).toHaveBeenCalledWith('breach.reported', expect.objectContaining({ breachId: 'breach-1' }));
  });
});

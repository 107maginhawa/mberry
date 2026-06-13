/**
 * listBreaches — characterization tests (AHA FIX-002 backfill)
 *
 * Path: GET /admin/breaches
 * Access: platformAdmin only. Returns breaches with a computed urgency colour
 * (red <1h, yellow 1-24h, green >24h to NPC notification deadline) and
 * hoursRemaining (floored at 0).
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { listBreaches } from './listBreaches';

const ADMIN = { id: 'pa-1', userId: 'admin-1', role: 'super' };

function breach(deadlineOffsetMs: number, overrides: Record<string, any> = {}) {
  return {
    id: 'breach-1',
    status: 'reported',
    notificationDeadline: new Date(Date.now() + deadlineOffsetMs),
    createdAt: new Date(),
    ...overrides,
  };
}

function makeDb(rows: any[]) {
  return {
    select: () => ({ from: () => ({ orderBy: () => ({ limit: async () => rows }) }) }),
  };
}

describe('listBreaches (characterization)', () => {
  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null });
    const res = await listBreaches(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without platformAdmin', async () => {
    const ctx = makeCtx({ user: { id: 'user-1', role: 'member' } });
    const res = await listBreaches(ctx);
    expect(res.status).toBe(403);
  });

  test('green urgency when more than 24h remain', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      database: makeDb([breach(48 * 60 * 60 * 1000)]),
    });
    const res = await listBreaches(ctx);
    expect((res as any).body?.data[0].urgency).toBe('green');
  });

  test('yellow urgency within 24h', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      database: makeDb([breach(12 * 60 * 60 * 1000)]),
    });
    const res = await listBreaches(ctx);
    expect((res as any).body?.data[0].urgency).toBe('yellow');
  });

  test('red urgency within 1h and hoursRemaining floored at 0 when past deadline', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      database: makeDb([breach(-60 * 60 * 1000)]),
    });
    const res = await listBreaches(ctx);
    const row = (res as any).body?.data[0];
    expect(row.urgency).toBe('red');
    expect(row.hoursRemaining).toBe(0);
  });
});

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { listAttendance } from './listAttendance';
import { EventsRepository } from './repos/events.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeAttendance = [
  { id: 'att-1', eventId: 'evt-1', personId: 'person-1', method: 'qr', checkedInAt: new Date() },
  { id: 'att-2', eventId: 'evt-1', personId: 'person-2', method: 'manual', checkedInAt: new Date() },
];

const fakeStats = { total: 2, qr: 1, manual: 1 };

// ─── Tests ──────────────────────────────────────────────

describe('listAttendance', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns attendance list with stats and 200', async () => {
    mocks = stubRepo(EventsRepository, {
      listAttendance: async () => fakeAttendance,
      getAttendanceStats: async () => fakeStats,
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await listAttendance(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta).toEqual(fakeStats);
  });

  test('returns empty attendance list', async () => {
    mocks = stubRepo(EventsRepository, {
      listAttendance: async () => [],
      getAttendanceStats: async () => ({ total: 0, qr: 0, manual: 0 }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await listAttendance(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
    expect(response.body.meta.total).toBe(0);
  });

  test('no session does not crash (no auth in handler)', async () => {
    // listAttendance does not access session.
    mocks = stubRepo(EventsRepository, {
      listAttendance: async () => [],
      getAttendanceStats: async () => ({ total: 0, qr: 0, manual: 0 }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'evt-1' },
    });

    const response = await listAttendance(ctx);
    expect(response.status).toBe(200);
  });
});

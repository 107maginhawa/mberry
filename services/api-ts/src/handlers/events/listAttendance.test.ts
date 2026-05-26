import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeAttendance as createFakeAttendance, fakeEvent as createFakeEvent } from '@/test-utils/factories';
import { listAttendance } from './listAttendance';
import { EventsRepository } from './repos/events.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeEvent = createFakeEvent({ organizationId: 'org-1' });

const attendanceList = [
  createFakeAttendance({ id: 'att-1', eventId: 'evt-1', personId: 'person-1', method: 'qr', checkedInAt: new Date() }),
  createFakeAttendance({ id: 'att-2', eventId: 'evt-1', personId: 'person-2', method: 'manual', checkedInAt: new Date() }),
];

const fakeStats = { total: 2, qr: 1, manual: 1 };

// ─── Tests ──────────────────────────────────────────────

describe('listAttendance', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let memberMocks: ReturnType<typeof stubRepo>;

  const stubMembership = () => stubRepo(MembershipRepository, {
    getMember: async () => ({ id: 'mem-1', personId: 'user-1', organizationId: 'org-1', status: 'active' }),
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (memberMocks) Object.values(memberMocks).forEach((m) => m.mockRestore());
  });

  test('returns attendance list with stats and 200', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      listAttendance: async () => attendanceList,
      getAttendanceStats: async () => fakeStats,
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await listAttendance(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta).toEqual({ ...fakeStats, limit: 50, offset: 0 });
  });

  test('returns empty attendance list', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
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

  test('throws UnauthorizedError when no session', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      listAttendance: async () => [],
      getAttendanceStats: async () => ({ total: 0, qr: 0, manual: 0 }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'evt-1' },
    });

    await expect(listAttendance(ctx)).rejects.toThrow();
  });
});

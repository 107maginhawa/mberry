import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { getEvent } from './getEvent';
import { EventsRepository } from './repos/events.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeEvent = {
  id: 'evt-1',
  organizationId: 'org-1',
  organizationId: 'org-1',
  title: 'Annual Conference',
  description: 'Yearly gathering',
  location: 'Manila',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-02'),
  registrationFee: 500,
  capacity: 100,
  status: 'published',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

const fakeStats = { total: 5, qr: 3, manual: 2 };

// ─── Tests ──────────────────────────────────────────────

describe('getEvent', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let memberMocks: ReturnType<typeof stubRepo>;

  const stubMembership = () => stubRepo(MembershipRepository, {
    getMember: async () => ({ id: 'mem-1', personId: 'user-1', orgId: 'org-1', status: 'active' }),
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (memberMocks) Object.values(memberMocks).forEach((m) => m.mockRestore());
  });

  test('returns event with registration count and attendance stats', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      getRegistrationCount: async () => 42,
      getAttendanceStats: async () => fakeStats,
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await getEvent(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('evt-1');
    expect(response.body.data.registrationCount).toBe(42);
    expect(response.body.data.attendance).toEqual(fakeStats);
  });

  test('throws NotFoundError for non-existent event', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => undefined,
      getRegistrationCount: async () => 0,
      getAttendanceStats: async () => ({ total: 0, qr: 0, manual: 0 }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-missing' },
    });

    await expect(getEvent(ctx)).rejects.toThrow('Event not found');
  });

  test('crashes without session (org ownership requires session)', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      getRegistrationCount: async () => 0,
      getAttendanceStats: async () => ({ total: 0, qr: 0, manual: 0 }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'evt-1' },
    });

    // session.user.id is accessed for org ownership check
    await expect(getEvent(ctx)).rejects.toThrow();
  });
});

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeEvent as createFakeEvent } from '@/test-utils/factories';
import { createEvent } from './createEvent';
import { updateEvent } from './updateEvent';
import { cancelEvent } from './cancelEvent';
import { bulkCreateEventSeries } from './bulkCreateEventSeries';
import { listAttendance } from './listAttendance';
import { listRegistrations } from './listRegistrations';
import { EventsRepository } from './repos/events.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeEvent = createFakeEvent({
  organizationId: 'org-1',
  status: 'draft',
});

// ─── Officer Denial Tests ──────────────────────────────

describe('Events auth enforcement — officer checks', () => {
  let mocks: ReturnType<typeof stubRepo>[];

  afterEach(() => {
    if (mocks) mocks.forEach(m => Object.values(m).forEach(v => v.mockRestore()));
  });

  test('createEvent returns 403 for non-officer', async () => {
    mocks = [
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [],
      }),
      stubRepo(EventsRepository, {
        create: async (data: any) => ({ ...fakeEvent, ...data }),
        findBySlug: async () => undefined,
      }),
    ];

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { title: 'Test', startDate: '2026-06-01', endDate: '2026-06-02' },
    });

    await expect(createEvent(ctx)).rejects.toThrow('Officer access required');
  });

  test('createEvent succeeds for officer', async () => {
    mocks = [
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [{ id: 'term-1' }],
      }),
      stubRepo(EventsRepository, {
        create: async (data: any) => ({ ...fakeEvent, ...data }),
        findBySlug: async () => undefined,
      }),
    ];

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { title: 'Test', startDate: '2026-06-01', endDate: '2026-06-02' },
    });

    const res = await createEvent(ctx);
    expect(res.status).toBe(201);
  });

  test('updateEvent returns 403 for non-officer', async () => {
    mocks = [
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [],
      }),
      stubRepo(EventsRepository, {
        get: async () => fakeEvent,
        update: async (id: string, data: any) => ({ ...fakeEvent, ...data }),
      }),
    ];

    const ctx = makeCtx({
      _params: { id: 'event-1' },
      _body: { title: 'Updated' },
    });

    await expect(updateEvent(ctx)).rejects.toThrow('Officer access required');
  });

  test('cancelEvent returns 403 for non-officer', async () => {
    mocks = [
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [],
      }),
      stubRepo(EventsRepository, {
        get: async () => fakeEvent,
        update: async (id: string, data: any) => ({ ...fakeEvent, ...data }),
      }),
    ];

    const ctx = makeCtx({
      _params: { id: 'event-1' },
    });

    await expect(cancelEvent(ctx)).rejects.toThrow('Officer access required');
  });

  test('bulkCreateEventSeries returns 403 for non-officer', async () => {
    mocks = [
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [],
      }),
      stubRepo(EventsRepository, {
        get: async () => fakeEvent,
        create: async (data: any) => ({ ...fakeEvent, ...data }),
        findBySlug: async () => undefined,
      }),
    ];

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { templateEventId: 'event-1', dates: ['2026-07-01'] },
    });

    await expect(bulkCreateEventSeries(ctx)).rejects.toThrow('Officer access required');
  });
});

// ─── Membership Denial Tests ──────────────────────────

describe('Events auth enforcement — membership checks', () => {
  let mocks: ReturnType<typeof stubRepo>[];

  afterEach(() => {
    if (mocks) mocks.forEach(m => Object.values(m).forEach(v => v.mockRestore()));
  });

  test('listAttendance throws 401 without session', async () => {
    mocks = [
      stubRepo(EventsRepository, {
        get: async () => fakeEvent,
        listAttendance: async () => [],
        getAttendanceStats: async () => ({}),
      }),
    ];

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'event-1' },
    });

    await expect(listAttendance(ctx)).rejects.toThrow();
  });

  test('listAttendance throws 404 for non-existent event', async () => {
    mocks = [
      stubRepo(EventsRepository, {
        get: async () => undefined,
      }),
    ];

    const ctx = makeCtx({ _params: { id: 'no-such' } });
    await expect(listAttendance(ctx)).rejects.toThrow('Event not found');
  });

  test('listAttendance throws 403 for non-member', async () => {
    mocks = [
      stubRepo(EventsRepository, {
        get: async () => fakeEvent,
      }),
      stubRepo(MembershipRepository, {
        getMember: async () => null,
      }),
    ];

    const ctx = makeCtx({ _params: { id: 'event-1' } });
    await expect(listAttendance(ctx)).rejects.toThrow('Access denied');
  });

  test('listAttendance succeeds for org member', async () => {
    mocks = [
      stubRepo(EventsRepository, {
        get: async () => fakeEvent,
        listAttendance: async () => [{ id: 'att-1' }],
        getAttendanceStats: async () => ({ total: 1 }),
      }),
      stubRepo(MembershipRepository, {
        getMember: async () => ({ id: 'mem-1' }),
      }),
    ];

    const ctx = makeCtx({ _params: { id: 'event-1' } });
    const res = await listAttendance(ctx);
    expect(res.status).toBe(200);
  });

  test('listRegistrations throws 401 without session', async () => {
    mocks = [
      stubRepo(EventsRepository, {
        get: async () => fakeEvent,
        listRegistrations: async () => [],
      }),
    ];

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'event-1' },
    });

    await expect(listRegistrations(ctx)).rejects.toThrow();
  });

  test('listRegistrations throws 403 for non-member', async () => {
    mocks = [
      stubRepo(EventsRepository, {
        get: async () => fakeEvent,
      }),
      stubRepo(MembershipRepository, {
        getMember: async () => null,
      }),
    ];

    const ctx = makeCtx({ _params: { id: 'event-1' } });
    await expect(listRegistrations(ctx)).rejects.toThrow('Access denied');
  });

  test('listRegistrations succeeds for org member', async () => {
    mocks = [
      stubRepo(EventsRepository, {
        get: async () => fakeEvent,
        listRegistrations: async () => [{ id: 'reg-1' }],
      }),
      stubRepo(MembershipRepository, {
        getMember: async () => ({ id: 'mem-1' }),
      }),
    ];

    const ctx = makeCtx({ _params: { id: 'event-1' } });
    const res = await listRegistrations(ctx);
    expect(res.status).toBe(200);
  });
});

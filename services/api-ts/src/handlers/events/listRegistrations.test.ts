import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeRegistration as createFakeRegistration, fakeEvent as createFakeEvent } from '@/test-utils/factories';
import { EventsRepository } from './repos/events.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';
import { listRegistrations } from './listRegistrations';

const fakeEvent = createFakeEvent({ organizationId: 'org-1' });

const fakeRegistration = createFakeRegistration({
  eventId: 'event-1',
  status: 'registered',
  registeredAt: new Date(),
});

describe('listRegistrations', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let memberMocks: ReturnType<typeof stubRepo>;

  const stubMembership = () => stubRepo(MembershipRepository, {
    getMember: async () => ({ id: 'mem-1', personId: 'user-1', organizationId: 'org-1', status: 'active' }),
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (memberMocks) Object.values(memberMocks).forEach((m) => m.mockRestore());
  });

  test('returns registrations for event', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      listRegistrations: async () => [fakeRegistration],
    });

    const ctx = makeCtx({
      _params: { id: 'event-1' },
    });

    const res = await listRegistrations(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toHaveLength(1);
    expect((res as any).body.data[0].eventId).toBe('event-1');
  });

  test('returns empty array when no registrations', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      listRegistrations: async () => [],
    });

    const ctx = makeCtx({
      _params: { id: 'event-no-regs' },
    });

    const res = await listRegistrations(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toHaveLength(0);
  });

  test('uses event ID from path params', async () => {
    memberMocks = stubMembership();
    let capturedEventId: string | undefined;
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      listRegistrations: async (eventId: string) => {
        capturedEventId = eventId;
        return [];
      },
    });

    const ctx = makeCtx({ _params: { id: 'event-xyz' } });
    await listRegistrations(ctx as any);
    expect(capturedEventId).toBe('event-xyz');
  });
});

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { updateEvent } from './updateEvent';
import { EventsRepository } from './repos/events.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeEvent = {
  id: 'evt-1',
  tenantId: 'org-1',
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

// ─── Tests ──────────────────────────────────────────────

describe('updateEvent', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let memberMocks: ReturnType<typeof stubRepo>;

  const stubMembership = () => stubRepo(MembershipRepository, {
    getMember: async () => ({ id: 'mem-1', personId: 'user-1', orgId: 'org-1', status: 'active' }),
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (memberMocks) Object.values(memberMocks).forEach((m) => m.mockRestore());
  });

  test('updates event and returns 200', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      update: async (_id: string, data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: { title: 'Updated Conference' },
    });

    const response = await updateEvent(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe('Updated Conference');
  });

  test('maps alternative field names (startAt/endAt/fee/locationDetails)', async () => {
    memberMocks = stubMembership();
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeEvent, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: {
        startAt: '2026-07-01',
        endAt: '2026-07-02',
        fee: 1500,
        locationDetails: 'Room 202',
      },
    });

    await updateEvent(ctx);
    expect(capturedData.registrationFee).toBe(1500);
    expect(capturedData.location).toBe('Room 202');
    expect(capturedData.startDate).toEqual(new Date('2026-07-01'));
    expect(capturedData.endDate).toEqual(new Date('2026-07-02'));
  });

  test('strips unsupported fields from body', async () => {
    memberMocks = stubMembership();
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeEvent, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: {
        title: 'Test',
        type: 'webinar',
        locationType: 'virtual',
        coverImage: 'img.png',
        qrEnabled: true,
        visibility: 'public',
        registrationEnabled: true,
      },
    });

    await updateEvent(ctx);
    // These fields are destructured out and not passed to repo
    expect(capturedData.type).toBeUndefined();
    expect(capturedData.locationType).toBeUndefined();
    expect(capturedData.coverImage).toBeUndefined();
    expect(capturedData.qrEnabled).toBeUndefined();
    // visibility is now persisted (BR-16)
    expect(capturedData.visibility).toBe('public');
    expect(capturedData.registrationEnabled).toBeUndefined();
  });

  test('throws NotFoundError for non-existent event', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => undefined,
      update: async (_id: string, data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-missing' },
      _body: { title: 'Nope' },
    });

    await expect(updateEvent(ctx)).rejects.toThrow('Event not found');
  });

  test('crashes without session (no auth)', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      update: async (_id: string, data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'evt-1' },
      _body: { title: 'Updated' },
    });

    // session.user.id is accessed for org ownership check + updatedBy
    await expect(updateEvent(ctx)).rejects.toThrow();
  });
});

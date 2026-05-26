import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeEvent as createFakeEvent } from '@/test-utils/factories';
import { updateEvent } from './updateEvent';
import { EventsRepository } from './repos/events.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeEvent = createFakeEvent({
  description: 'Yearly gathering',
  location: 'Manila',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-02'),
  registrationFee: 500,
  capacity: 100,
});

// ─── Tests ──────────────────────────────────────────────

describe('updateEvent', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  const stubOfficer = () => stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ id: 'term-1' }],
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
  });

  test('updates event and returns 200', async () => {
    officerMocks = stubOfficer();
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
    officerMocks = stubOfficer();
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
    officerMocks = stubOfficer();
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
    officerMocks = stubOfficer();
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

  test('throws STATUS_UPDATE_NOT_ALLOWED if status provided in body', async () => {
    officerMocks = stubOfficer();
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      update: async (_id: string, data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: { title: 'Updated', status: 'published' },
    });

    await expect(updateEvent(ctx)).rejects.toMatchObject({ code: 'STATUS_UPDATE_NOT_ALLOWED' });
  });

  test('does not pass status to repo when status not in body', async () => {
    officerMocks = stubOfficer();
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeEvent, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: { title: 'Safe Update' },
    });

    await updateEvent(ctx);
    expect(capturedData.status).toBeUndefined();
  });

  test('crashes without session (no auth)', async () => {
    officerMocks = stubOfficer();
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

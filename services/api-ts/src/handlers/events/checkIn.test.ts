import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { checkIn } from './checkIn';
import { EventsRepository } from './repos/events.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeEvent = {
  id: 'evt-1',
  tenantId: 'org-1',
  organizationId: 'org-1',
  title: 'Annual Conference',
  status: 'published',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

const fakeAttendance = {
  id: 'att-1',
  tenantId: 'org-1',
  eventId: 'evt-1',
  personId: 'person-1',
  method: 'manual',
  checkedInBy: 'officer-1',
  checkedInAt: new Date(),
  createdBy: 'person-1',
  updatedBy: 'person-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('checkIn', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('checks in attendee and returns 201', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      isCheckedIn: async () => false,
      checkIn: async (data: any) => ({ ...fakeAttendance, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: { personId: 'person-1', checkedInBy: 'officer-1' },
    });

    const response = await checkIn(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.eventId).toBe('evt-1');
    expect(response.body.data.personId).toBe('person-1');
  });

  test('defaults method to manual', async () => {
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      isCheckedIn: async () => false,
      checkIn: async (data: any) => { capturedData = data; return { ...fakeAttendance, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: { personId: 'person-1', checkedInBy: 'officer-1' },
    });

    await checkIn(ctx);
    expect(capturedData.method).toBe('manual');
  });

  test('accepts qr method', async () => {
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      isCheckedIn: async () => false,
      checkIn: async (data: any) => { capturedData = data; return { ...fakeAttendance, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: { personId: 'person-1', method: 'qr', checkedInBy: 'officer-1' },
    });

    await checkIn(ctx);
    expect(capturedData.method).toBe('qr');
  });

  test('throws ConflictError when already checked in', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      isCheckedIn: async () => true,
      checkIn: async (data: any) => fakeAttendance,
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: { personId: 'person-1', checkedInBy: 'officer-1' },
    });

    await expect(checkIn(ctx)).rejects.toThrow('Already checked in');
  });

  test('throws NotFoundError for non-existent event', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => undefined,
      isCheckedIn: async () => false,
      checkIn: async (data: any) => fakeAttendance,
    });

    const ctx = makeCtx({
      _params: { id: 'evt-missing' },
      _body: { personId: 'person-1', checkedInBy: 'officer-1' },
    });

    await expect(checkIn(ctx)).rejects.toThrow('Event not found');
  });

  test('allows check-in without prior registration (no guard)', async () => {
    // Handler does not verify that personId is registered for the event.
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      isCheckedIn: async () => false,
      checkIn: async (data: any) => ({ ...fakeAttendance, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: { personId: 'unregistered-person', checkedInBy: 'officer-1' },
    });

    const response = await checkIn(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.personId).toBe('unregistered-person');
  });

  test('no session does not crash (no auth in handler)', async () => {
    // checkIn does not access session — it reads personId from body.
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      isCheckedIn: async () => false,
      checkIn: async (data: any) => ({ ...fakeAttendance, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'evt-1' },
      _body: { personId: 'person-1', checkedInBy: 'officer-1' },
    });

    const response = await checkIn(ctx);
    expect(response.status).toBe(201);
  });
});

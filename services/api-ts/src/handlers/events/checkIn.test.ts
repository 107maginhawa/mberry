// Business Rules: [BR-17]
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeEvent as createFakeEvent } from '@/test-utils/factories';
import { checkIn } from './checkIn';
import { EventsRepository } from './repos/events.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeEvent = createFakeEvent();

const fakeAttendance = {
  id: 'att-1',
  organizationId: 'org-1',
  eventId: 'evt-1',
  personId: 'person-1',
  method: 'manual',
  checkedInBy: 'officer-1',
  checkedInAt: new Date(),
  createdBy: 'person-1',
  updatedBy: 'person-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('[BR-17] checkIn', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(EventsRepository);
    restoreRepo(OfficerTermRepository);
    // Default: user is an officer
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
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

  test('[BR-17] defaults method to manual', async () => {
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

  test('[BR-17] accepts qr method', async () => {
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

  test('[BR-17] throws ConflictError when already checked in (duplicate scan)', async () => {
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

  test('throws ForbiddenError when user has no officer term', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      isCheckedIn: async () => false,
      checkIn: async (data: any) => fakeAttendance,
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: { personId: 'person-1' },
    });

    await expect(checkIn(ctx)).rejects.toThrow('Officer access required');
  });

  test('uses session.user.id for audit fields, ignores body.checkedInBy', async () => {
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      isCheckedIn: async () => false,
      checkIn: async (data: any) => { capturedData = data; return { ...fakeAttendance, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: { personId: 'person-1', checkedInBy: 'attacker-fake-id' },
    });

    const response = await checkIn(ctx);
    expect(response.status).toBe(201);
    // P1-3 fix: checkedInBy comes from session, not body
    expect(capturedData.checkedInBy).not.toBe('attacker-fake-id');
    expect(capturedData.createdBy).toBe(capturedData.checkedInBy);
  });

  test('[M8-R6] throws BusinessLogicError when event is completed', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, status: 'completed' }),
      isCheckedIn: async () => false,
      checkIn: async (data: any) => fakeAttendance,
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: { personId: 'person-1' },
    });

    await expect(checkIn(ctx)).rejects.toThrow('Check-in is not available after event completion.');
  });

  test('triggers credit pipeline job for credit-bearing event', async () => {
    const triggered: any[] = [];
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, creditBearing: true, creditAmount: 5, cpdActivityType: 'lecture', organizationId: 'org-1' }),
      isCheckedIn: async () => false,
      checkIn: async (data: any) => ({ ...fakeAttendance, ...data }),
    });

    const jobs = { trigger: async (name: string, payload: any) => { triggered.push({ name, payload }); } };
    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: { personId: 'person-1' },
      jobs,
    });

    const response = await checkIn(ctx);
    expect(response.status).toBe(201);
    const attendanceJob = triggered.find((t) => t.name === 'attendance.confirmed');
    expect(attendanceJob).toBeDefined();
    expect(attendanceJob.payload.creditAmount).toBe(5);
  });

  test('swallows credit-pipeline job failure (non-blocking)', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, creditBearing: true, creditAmount: 5, organizationId: 'org-1' }),
      isCheckedIn: async () => false,
      checkIn: async (data: any) => ({ ...fakeAttendance, ...data }),
    });

    const jobs = { trigger: async () => { throw new Error('boom'); } };
    const ctx = makeCtx({
      _params: { id: 'evt-1' },
      _body: { personId: 'person-1' },
      jobs,
    });

    const response = await checkIn(ctx);
    expect(response.status).toBe(201);
  });
});

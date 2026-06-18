import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { promoteWaitlistEntry } from './promoteWaitlistEntry';
import { WaitlistEntryRepository, EventRegistrationRepository, EventRepository } from './repos/events.repo';
import { NotFoundError } from '@/core/errors';

describe('promoteWaitlistEntry — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1', entryId: 'wl-1' } });
    const response = await promoteWaitlistEntry(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { eventId: 'evt-1', entryId: 'wl-1' } });
    const response = await promoteWaitlistEntry(ctx);
    expect(response.status).toBe(403);
  });
});

describe('promoteWaitlistEntry — business logic', () => {
  let waitlistMocks: ReturnType<typeof stubRepo>;
  let regMocks: ReturnType<typeof stubRepo>;
  let eventMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(WaitlistEntryRepository);
    restoreRepo(EventRegistrationRepository);
    restoreRepo(EventRepository);
  });

  afterEach(() => {
    if (waitlistMocks) Object.values(waitlistMocks).forEach((m) => m.mockRestore());
    if (regMocks) Object.values(regMocks).forEach((m) => m.mockRestore());
    if (eventMocks) Object.values(eventMocks).forEach((m) => m.mockRestore());
    restoreRepo(WaitlistEntryRepository);
    restoreRepo(EventRegistrationRepository);
    restoreRepo(EventRepository);
  });

  test('promotes waitlist entry and returns created registration', async () => {
    const entry = { id: 'wl-1', eventId: 'evt-1', personId: 'person-5', position: 1, promotedAt: null };
    const registration = { id: 'reg-1', eventId: 'evt-1', personId: 'person-5', status: 'confirmed', organizationId: 'org-1' };

    waitlistMocks = stubRepo(WaitlistEntryRepository, {
      findOneById: async () => entry,
      updateOneById: async () => ({ ...entry, promotedAt: new Date() }),
    });
    regMocks = stubRepo(EventRegistrationRepository, {
      createOne: async () => registration,
    });
    // notifService is null by default so EventRepository not called
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => ({ id: 'evt-1', title: 'Conference' }),
    });

    const ctx = makeCtx({
      _params: { eventId: 'evt-1', entryId: 'wl-1' },
    });
    const response = await promoteWaitlistEntry(ctx);
    expect(response.status).toBe(201);
    expect((response as any).body.status).toBe('confirmed');
    expect((response as any).body.personId).toBe('person-5');
  });

  test('creates registration with confirmed status', async () => {
    const entry = { id: 'wl-2', eventId: 'evt-1', personId: 'person-10', position: 2 };
    let capturedRegData: any = null;
    waitlistMocks = stubRepo(WaitlistEntryRepository, {
      findOneById: async () => entry,
      updateOneById: async () => ({ ...entry, promotedAt: new Date() }),
    });
    regMocks = stubRepo(EventRegistrationRepository, {
      createOne: async (data: any) => {
        capturedRegData = data;
        return { id: 'reg-2', ...data };
      },
    });
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => ({ id: 'evt-1', title: 'Workshop' }),
    });

    const ctx = makeCtx({
      _params: { eventId: 'evt-1', entryId: 'wl-2' },
    });
    await promoteWaitlistEntry(ctx);
    expect(capturedRegData.status).toBe('confirmed');
    expect(capturedRegData.personId).toBe('person-10');
    expect(capturedRegData.eventId).toBe('evt-1');
  });

  test('marks waitlist entry as promoted with promotedAt timestamp', async () => {
    const entry = { id: 'wl-3', eventId: 'evt-1', personId: 'person-11', position: 3 };
    let capturedUpdateData: any = null;
    waitlistMocks = stubRepo(WaitlistEntryRepository, {
      findOneById: async () => entry,
      updateOneById: async (_id: string, data: any) => {
        capturedUpdateData = data;
        return { ...entry, ...data };
      },
    });
    regMocks = stubRepo(EventRegistrationRepository, {
      createOne: async (data: any) => ({ id: 'reg-3', ...data }),
    });
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({
      _params: { eventId: 'evt-1', entryId: 'wl-3' },
    });
    await promoteWaitlistEntry(ctx);
    expect(capturedUpdateData.promotedAt).toBeInstanceOf(Date);
  });

  test('throws NotFoundError when waitlist entry does not exist', async () => {
    waitlistMocks = stubRepo(WaitlistEntryRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { eventId: 'evt-1', entryId: 'no-such-entry' },
    });
    await expect(promoteWaitlistEntry(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});

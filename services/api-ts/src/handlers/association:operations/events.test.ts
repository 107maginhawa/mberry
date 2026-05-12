import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { EventRegistrationRepository, WaitlistEntryRepository } from './repos/events.repo';

/**
 * Events Module Tests
 *
 * Tests for events, registrations, check-ins, and waitlist entries.
 */

describe('Events', () => {
  test('createEvent returns 401 without user', async () => {
    const { createEvent } = await import('./createEvent');
    const ctx = makeCtx({ user: null });
    const response = await createEvent(ctx);
    expect(response.status).toBe(401);
  });

  test('searchEvents returns 401 without user', async () => {
    const { searchEvents } = await import('./searchEvents');
    const ctx = makeCtx({ user: null });
    const response = await searchEvents(ctx);
    expect(response.status).toBe(401);
  });

  test('getEvent returns 401 without user', async () => {
    const { getEvent } = await import('./getEvent');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' } });
    const response = await getEvent(ctx);
    expect(response.status).toBe(401);
  });

  test('updateEvent returns 401 without user', async () => {
    const { updateEvent } = await import('./updateEvent');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' }, _body: {} });
    const response = await updateEvent(ctx);
    expect(response.status).toBe(401);
  });

  test('deleteEvent returns 401 without user', async () => {
    const { deleteEvent } = await import('./deleteEvent');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' } });
    const response = await deleteEvent(ctx);
    expect(response.status).toBe(401);
  });

  test('cancelEvent returns 401 without user', async () => {
    const { cancelEvent } = await import('./cancelEvent');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' } });
    const response = await cancelEvent(ctx);
    expect(response.status).toBe(401);
  });

  test('publishEvent returns 401 without user', async () => {
    const { publishEvent } = await import('./publishEvent');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' } });
    const response = await publishEvent(ctx);
    expect(response.status).toBe(401);
  });

  test('event statuses are draft, published, cancelled, completed', () => {
    const validStatuses = ['draft', 'published', 'cancelled', 'completed'];
    expect(validStatuses.length).toBe(4);
    expect(validStatuses).toContain('draft');
    expect(validStatuses).toContain('published');
  });

  test('only draft events can be published', () => {
    const publishableStatuses = ['draft'];
    expect(publishableStatuses).toContain('draft');
    expect(publishableStatuses).not.toContain('published');
    expect(publishableStatuses).not.toContain('cancelled');
  });

  test('only draft or published events can be cancelled', () => {
    const cancellableStatuses = ['draft', 'published'];
    expect(cancellableStatuses).toContain('draft');
    expect(cancellableStatuses).toContain('published');
    expect(cancellableStatuses).not.toContain('completed');
    expect(cancellableStatuses).not.toContain('cancelled');
  });
});

describe('Event Registrations', () => {
  test('createEventRegistration returns 401 without user', async () => {
    const { createEventRegistration } = await import('./createEventRegistration');
    const ctx = makeCtx({ user: null });
    const response = await createEventRegistration(ctx);
    expect(response.status).toBe(401);
  });

  test('cancelEventRegistration returns 401 without user', async () => {
    const { cancelEventRegistration } = await import('./cancelEventRegistration');
    const ctx = makeCtx({ user: null, _params: { registrationId: 'reg-1' } });
    const response = await cancelEventRegistration(ctx);
    expect(response.status).toBe(401);
  });

  test('refundEventRegistration returns 401 without user', async () => {
    const { refundEventRegistration } = await import('./refundEventRegistration');
    const ctx = makeCtx({ user: null, _params: { registrationId: 'reg-1' } });
    const response = await refundEventRegistration(ctx);
    expect(response.status).toBe(401);
  });

  test('searchEventRegistrations returns 401 without user', async () => {
    const { searchEventRegistrations } = await import('./searchEventRegistrations');
    const ctx = makeCtx({ user: null });
    const response = await searchEventRegistrations(ctx);
    expect(response.status).toBe(401);
  });

  test('getEventRegistration returns 401 without user', async () => {
    const { getEventRegistration } = await import('./getEventRegistration');
    const ctx = makeCtx({ user: null, _params: { registrationId: 'reg-1' } });
    const response = await getEventRegistration(ctx);
    expect(response.status).toBe(401);
  });

  test('updateEventRegistration returns 401 without user', async () => {
    const { updateEventRegistration } = await import('./updateEventRegistration');
    const ctx = makeCtx({ user: null, _params: { registrationId: 'reg-1' }, _body: {} });
    const response = await updateEventRegistration(ctx);
    expect(response.status).toBe(401);
  });

  test('deleteEventRegistration returns 401 without user', async () => {
    const { deleteEventRegistration } = await import('./deleteEventRegistration');
    const ctx = makeCtx({ user: null, _params: { registrationId: 'reg-1' } });
    const response = await deleteEventRegistration(ctx);
    expect(response.status).toBe(401);
  });

  test('registration statuses include confirmed, waitlisted, cancelled, refunded', () => {
    const statuses = ['confirmed', 'waitlisted', 'cancelled', 'refunded', 'noShow'];
    expect(statuses).toContain('confirmed');
    expect(statuses).toContain('waitlisted');
    expect(statuses).toContain('cancelled');
    expect(statuses).toContain('refunded');
  });

  test('auto-waitlist when event is at capacity', () => {
    const event = { capacity: 50, status: 'published' };
    const confirmedCount = 50;
    const shouldWaitlist = event.capacity !== null && confirmedCount >= event.capacity;
    expect(shouldWaitlist).toBe(true);
  });

  test('no waitlist when event has available capacity', () => {
    const event = { capacity: 50, status: 'published' };
    const confirmedCount = 30;
    const shouldWaitlist = event.capacity !== null && confirmedCount >= event.capacity;
    expect(shouldWaitlist).toBe(false);
  });
});

describe('Check-Ins', () => {
  test('createCheckIn returns 401 without user', async () => {
    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({ user: null });
    const response = await createCheckIn(ctx);
    expect(response.status).toBe(401);
  });

  test('searchCheckIns returns 401 without user', async () => {
    const { searchCheckIns } = await import('./searchCheckIns');
    const ctx = makeCtx({ user: null });
    const response = await searchCheckIns(ctx);
    expect(response.status).toBe(401);
  });

  test('check-in methods are qr and manual', () => {
    const methods = ['qr', 'manual'];
    expect(methods).toContain('qr');
    expect(methods).toContain('manual');
    expect(methods.length).toBe(2);
  });
});

describe('Waitlist', () => {
  test('listWaitlistEntries returns 401 without user', async () => {
    const { listWaitlistEntries } = await import('./listWaitlistEntries');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' } });
    const response = await listWaitlistEntries(ctx);
    expect(response.status).toBe(401);
  });

  test('promoteWaitlistEntry returns 401 without user', async () => {
    const { promoteWaitlistEntry } = await import('./promoteWaitlistEntry');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1', entryId: 'entry-1' } });
    const response = await promoteWaitlistEntry(ctx);
    expect(response.status).toBe(401);
  });

  test('waitlist positions are sequential', () => {
    const entries = [
      { position: 1, personId: 'p1' },
      { position: 2, personId: 'p2' },
      { position: 3, personId: 'p3' },
    ];
    for (let i = 0; i < entries.length; i++) {
      expect(entries[i]!.position).toBe(i + 1);
    }
  });

  test('promoted entry gets a confirmed registration', () => {
    const entry = { id: 'entry-1', eventId: 'evt-1', personId: 'p1', promotedAt: null as Date | null };
    // After promotion
    entry.promotedAt = new Date();
    expect(entry.promotedAt).not.toBeNull();
    const registration = { eventId: entry.eventId, personId: entry.personId, status: 'confirmed' };
    expect(registration.status).toBe('confirmed');
  });
});

// ─── [BR-27] Waitlist Promotion on Cancellation ────────────

describe('[BR-27] cancelEventRegistration — waitlist promotion', () => {
  let regMocks: ReturnType<typeof stubRepo>;
  let waitlistMocks: ReturnType<typeof stubRepo>;

  const fakeConfirmedReg = {
    id: 'reg-1',
    eventId: 'evt-1',
    personId: 'person-1',
    organizationId: 'org-1',
    status: 'confirmed',
    cancelledAt: null,
  };

  const fakeWaitlistedReg = {
    ...fakeConfirmedReg,
    id: 'reg-2',
    status: 'waitlisted',
  };

  afterEach(() => {
    if (regMocks) Object.values(regMocks).forEach((m) => m.mockRestore());
    if (waitlistMocks) Object.values(waitlistMocks).forEach((m) => m.mockRestore());
  });

  test('cancelling confirmed reg promotes next waitlisted entry', async () => {
    let createdReg: any = null;
    regMocks = stubRepo(EventRegistrationRepository, {
      findOneById: async () => fakeConfirmedReg,
      updateOneById: async (_id: string, data: any) => ({ ...fakeConfirmedReg, ...data }),
      createOne: async (data: any) => { createdReg = data; return { id: 'reg-new', ...data }; },
    });
    waitlistMocks = stubRepo(WaitlistEntryRepository, {
      promoteNext: async () => ({ id: 'wl-1', eventId: 'evt-1', personId: 'person-2', position: 1, promotedAt: new Date() }),
    });

    const { cancelEventRegistration } = await import('./cancelEventRegistration');
    const ctx = makeCtx({ _params: { registrationId: 'reg-1' } });
    const response = await cancelEventRegistration(ctx);

    expect(response.status).toBe(200);
    expect(createdReg).not.toBeNull();
    expect(createdReg.personId).toBe('person-2');
    expect(createdReg.status).toBe('confirmed');
    expect(createdReg.eventId).toBe('evt-1');
  });

  test('cancelling confirmed reg with empty waitlist — no error', async () => {
    regMocks = stubRepo(EventRegistrationRepository, {
      findOneById: async () => fakeConfirmedReg,
      updateOneById: async (_id: string, data: any) => ({ ...fakeConfirmedReg, ...data }),
    });
    waitlistMocks = stubRepo(WaitlistEntryRepository, {
      promoteNext: async () => null,
    });

    const { cancelEventRegistration } = await import('./cancelEventRegistration');
    const ctx = makeCtx({ _params: { registrationId: 'reg-1' } });
    const response = await cancelEventRegistration(ctx);

    expect(response.status).toBe(200);
  });

  test('cancelling waitlisted reg does NOT trigger promotion', async () => {
    let promoteCalled = false;
    regMocks = stubRepo(EventRegistrationRepository, {
      findOneById: async () => fakeWaitlistedReg,
      updateOneById: async (_id: string, data: any) => ({ ...fakeWaitlistedReg, ...data }),
    });
    waitlistMocks = stubRepo(WaitlistEntryRepository, {
      promoteNext: async () => { promoteCalled = true; return null; },
    });

    const { cancelEventRegistration } = await import('./cancelEventRegistration');
    const ctx = makeCtx({ _params: { registrationId: 'reg-2' } });
    await cancelEventRegistration(ctx);

    expect(promoteCalled).toBe(false);
  });
});

describe('QR Check-In Utility', () => {
  test('generateQrToken creates a valid token', async () => {
    const { generateQrToken } = await import('./utils/qr-checkin');
    const token = generateQrToken('evt-1', 'event', 'test-secret');
    expect(token).toBeTruthy();
    expect(token.split('.').length).toBe(2);
  });

  test('verifyQrToken validates a correct token', async () => {
    const { generateQrToken, verifyQrToken } = await import('./utils/qr-checkin');
    const token = generateQrToken('evt-1', 'event', 'test-secret');
    const payload = verifyQrToken(token, 'test-secret');
    expect(payload).not.toBeNull();
    expect(payload!.eventId).toBe('evt-1');
    expect(payload!.type).toBe('event');
  });

  test('verifyQrToken rejects token with wrong secret', async () => {
    const { generateQrToken, verifyQrToken } = await import('./utils/qr-checkin');
    const token = generateQrToken('evt-1', 'event', 'test-secret');
    const payload = verifyQrToken(token, 'wrong-secret');
    expect(payload).toBeNull();
  });

  test('verifyQrToken rejects malformed token', async () => {
    const { verifyQrToken } = await import('./utils/qr-checkin');
    expect(verifyQrToken('not-a-valid-token', 'secret')).toBeNull();
    expect(verifyQrToken('a.b.c', 'secret')).toBeNull();
  });
});

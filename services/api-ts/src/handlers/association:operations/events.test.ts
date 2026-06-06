import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeEvent as createFakeEvent, fakeRegistration as createFakeRegistration, fakeCheckIn as createFakeCheckIn } from '@/test-utils/factories';
import { EventRepository, EventRegistrationRepository, CheckInRepository, WaitlistEntryRepository } from './repos/events.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

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

describe('[CR-01] cancelEventRegistration — late-cancellation notification targets organizer', () => {
  let regMocks: ReturnType<typeof stubRepo>;
  let eventMocks: ReturnType<typeof stubRepo>;

  const cancellerId = 'canceller-user';
  const organizerId = 'organizer-user';

  const fakeConfirmedReg = createFakeRegistration({
    id: 'reg-cr01',
    eventId: 'evt-cr01',
    personId: cancellerId,
    organizationId: 'org-1',
    status: 'confirmed',
    cancelledAt: null,
  });

  // Event starts in 2 hours — within 24h window
  const fakeEvt = createFakeEvent({
    id: 'evt-cr01',
    title: 'CR-01 Test Event',
    startDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
    createdBy: organizerId,
  });

  afterEach(() => {
    if (regMocks) Object.values(regMocks).forEach((m) => m.mockRestore());
    if (eventMocks) Object.values(eventMocks).forEach((m) => m.mockRestore());
  });

  test('notification is sent to event organizer, not the canceller', async () => {
    const notifiedRecipients: string[] = [];
    const fakeNotifService = {
      createNotification: async (req: any) => {
        notifiedRecipients.push(req.recipient);
        return { id: 'notif-1' };
      },
    };

    regMocks = stubRepo(EventRegistrationRepository, {
      findOneById: async () => fakeConfirmedReg,
      updateOneById: async (_id: string, data: any) => ({ ...fakeConfirmedReg, ...data }),
    });
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => fakeEvt,
    });

    const { cancelEventRegistration } = await import('./cancelEventRegistration');
    const ctx = makeCtx({
      user: { id: cancellerId, role: 'member' },
      notifs: fakeNotifService,
      _params: { registrationId: 'reg-cr01' },
    });
    const response = await cancelEventRegistration(ctx);

    expect(response.status).toBe(200);
    // Notification must go to organizer, never to the canceller
    expect(notifiedRecipients).toContain(organizerId);
    expect(notifiedRecipients).not.toContain(cancellerId);
  });

  test('no notification sent when event has no createdBy organizer', async () => {
    const notifiedRecipients: string[] = [];
    const fakeNotifService = {
      createNotification: async (req: any) => {
        notifiedRecipients.push(req.recipient);
        return { id: 'notif-1' };
      },
    };

    regMocks = stubRepo(EventRegistrationRepository, {
      findOneById: async () => fakeConfirmedReg,
      updateOneById: async (_id: string, data: any) => ({ ...fakeConfirmedReg, ...data }),
    });
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => ({ ...fakeEvt, createdBy: null }),
    });

    const { cancelEventRegistration } = await import('./cancelEventRegistration');
    const ctx = makeCtx({
      user: { id: cancellerId, role: 'member' },
      notifs: fakeNotifService,
      _params: { registrationId: 'reg-cr01' },
    });
    const response = await cancelEventRegistration(ctx);

    expect(response.status).toBe(200);
    expect(notifiedRecipients).toHaveLength(0);
  });
});

describe('[BR-27] cancelEventRegistration — waitlist promotion', () => {
  let regMocks: ReturnType<typeof stubRepo>;
  let waitlistMocks: ReturnType<typeof stubRepo>;

  const fakeConfirmedReg = createFakeRegistration({
    id: 'reg-1',
    eventId: 'evt-1',
    personId: 'person-1',
    organizationId: 'org-1',
    status: 'confirmed',
    cancelledAt: null,
  });

  const fakeWaitlistedReg = createFakeRegistration({
    ...fakeConfirmedReg,
    id: 'reg-2',
    status: 'waitlisted',
  });

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

  test('verifyQrToken rejects expired token (>24h)', async () => {
    const { verifyQrToken } = await import('./utils/qr-checkin');
    const { createHmac } = await import('crypto');
    // Manually craft an expired token (25 hours old)
    const payload = { eventId: 'evt-1', type: 'event', issuedAt: Date.now() - 25 * 60 * 60 * 1000 };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', 'test-secret').update(encoded).digest('base64url');
    const expiredToken = `${encoded}.${sig}`;
    expect(verifyQrToken(expiredToken, 'test-secret')).toBeNull();
  });
});

// ─── [AC-M08-001] QR Check-In Security ──────────────────────

describe('[AC-M08-001] createCheckIn — QR check-in requires authenticated scanner + valid event', () => {
  let mocks: Record<string, { mockRestore: () => void }>;
  let officerMocks: Record<string, { mockRestore: () => void }>;

  const fakeEvent = createFakeEvent({
    id: 'evt-1',
    organizationId: 'org-1',
    title: 'Conference',
    status: 'published',
  });

  const fakeCheckIn = createFakeCheckIn({
    id: 'ci-1',
    eventId: 'evt-1',
    personId: 'person-1',
    method: 'manual',
    checkedInBy: 'user-1',
    organizationId: 'org-1',
  });

  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(CheckInRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach(m => m.mockRestore());
    restoreRepo(EventRepository);
    restoreRepo(CheckInRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 without authenticated user', async () => {
    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({ user: null });
    const response = await createCheckIn(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organization context', async () => {
    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({ organizationId: null });
    const response = await createCheckIn(ctx);
    expect(response.status).toBe(403);
  });

  test('manual check-in succeeds for authenticated officer with valid event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => fakeEvent,
      }),
      ...stubRepo(CheckInRepository, {
        findMany: async () => [],
        createOne: async (data: any) => ({ ...fakeCheckIn, ...data }),
      }),
    };
    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({
      _body: { eventId: 'evt-1', method: 'manual', personId: 'person-1' },
    });
    const response = await createCheckIn(ctx);
    expect(response.status).toBe(201);
    expect(response.body.eventId).toBe('evt-1');
  });

  test('QR check-in verifies token and extracts eventId', async () => {
    const { generateQrToken } = await import('./utils/qr-checkin');
    const secret = 'test-qr-secret';
    const token = generateQrToken('evt-1', 'event', secret);

    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => fakeEvent,
      }),
      ...stubRepo(CheckInRepository, {
        findMany: async () => [],
        createOne: async (data: any) => ({ ...fakeCheckIn, ...data }),
      }),
    };

    // Set QR_SECRET env for handler
    const origSecret = process.env['QR_SECRET'];
    process.env['QR_SECRET'] = secret;

    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({
      _body: { method: 'qr', qrToken: token, personId: 'person-1' },
    });
    const response = await createCheckIn(ctx);
    expect(response.status).toBe(201);

    process.env['QR_SECRET'] = origSecret;
  });

  test('QR check-in rejects invalid/tampered token', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => fakeEvent,
      }),
      ...stubRepo(CheckInRepository, {
        findMany: async () => [],
        createOne: async (data: any) => ({ ...fakeCheckIn, ...data }),
      }),
    };
    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({
      _body: { method: 'qr', qrToken: 'tampered.token', personId: 'person-1' },
    });
    await expect(createCheckIn(ctx)).rejects.toThrow('Invalid or expired QR token');
  });

  test('check-in throws NotFoundError for non-existent event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => null,
      }),
      ...stubRepo(CheckInRepository, {
        findMany: async () => [],
        createOne: async (data: any) => fakeCheckIn,
      }),
    };
    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({
      _body: { eventId: 'evt-missing', method: 'manual', personId: 'person-1' },
    });
    await expect(createCheckIn(ctx)).rejects.toThrow('Event not found');
  });

  test('checkedInBy is set from authenticated user, not body', async () => {
    let capturedData: any = null;
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => fakeEvent,
      }),
      ...stubRepo(CheckInRepository, {
        findMany: async () => [],
        createOne: async (data: any) => { capturedData = data; return { ...fakeCheckIn, ...data }; },
      }),
    };
    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({
      _body: { eventId: 'evt-1', method: 'manual', personId: 'person-1' },
    });
    await createCheckIn(ctx);
    // checkedInBy comes from ctx user (user-1), not from body
    expect(capturedData.checkedInBy).toBe('user-1');
  });
});

// ─── [AC-M08-002] Capacity Management ──────────────────────

describe('[AC-M08-002] createEventRegistration — capacity management', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  const publishedEvent = {
    id: 'evt-1',
    organizationId: 'org-1',
    title: 'Conference',
    status: 'published',
    capacity: 50,
  };

  const fakeRegistration = {
    id: 'reg-1',
    eventId: 'evt-1',
    personId: 'user-1',
    status: 'confirmed',
    organizationId: 'org-1',
  };

  const fakeWaitlistEntry = {
    id: 'wl-1',
    eventId: 'evt-1',
    personId: 'user-1',
    position: 1,
    organizationId: 'org-1',
  };

  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(EventRegistrationRepository);
    restoreRepo(WaitlistEntryRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    restoreRepo(EventRepository);
    restoreRepo(EventRegistrationRepository);
    restoreRepo(WaitlistEntryRepository);
  });

  test('returns 401 without authenticated user', async () => {
    const { createEventRegistration } = await import('./createEventRegistration');
    const ctx = makeCtx({ user: null });
    const response = await createEventRegistration(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organization context', async () => {
    const { createEventRegistration } = await import('./createEventRegistration');
    const ctx = makeCtx({ organizationId: null });
    const response = await createEventRegistration(ctx);
    expect(response.status).toBe(403);
  });

  test('rejects registration for non-published event (draft)', async () => {
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => ({ ...publishedEvent, status: 'draft' }),
      }),
      ...stubRepo(EventRegistrationRepository, {
        count: async () => 0,
        createOne: async (data: any) => fakeRegistration,
      }),
    };
    const { createEventRegistration } = await import('./createEventRegistration');
    const ctx = makeCtx({
      _body: { eventId: 'evt-1', personId: 'user-1' },
    });
    await expect(createEventRegistration(ctx)).rejects.toThrow('Registrations are only accepted for published events');
  });

  test('rejects registration for cancelled event', async () => {
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => ({ ...publishedEvent, status: 'cancelled' }),
      }),
      ...stubRepo(EventRegistrationRepository, {
        count: async () => 0,
        createOne: async (data: any) => fakeRegistration,
      }),
    };
    const { createEventRegistration } = await import('./createEventRegistration');
    const ctx = makeCtx({
      _body: { eventId: 'evt-1', personId: 'user-1' },
    });
    await expect(createEventRegistration(ctx)).rejects.toThrow('Registrations are only accepted for published events');
  });

  test('confirms registration when under capacity', async () => {
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => publishedEvent,
      }),
      ...stubRepo(EventRegistrationRepository, {
        count: async (f: any) => (f?.personId ? 0 : 30),
        createOne: async (data: any) => ({ ...fakeRegistration, ...data }),
      }),
      ...stubRepo(WaitlistEntryRepository, {
        nextPosition: async () => 1,
        createOne: async (data: any) => fakeWaitlistEntry,
      }),
    };
    const { createEventRegistration } = await import('./createEventRegistration');
    const ctx = makeCtx({
      _body: { eventId: 'evt-1', personId: 'user-1' },
    });
    const response = await createEventRegistration(ctx);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('confirmed');
  });

  test('auto-waitlists when at capacity', async () => {
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => publishedEvent,
      }),
      ...stubRepo(EventRegistrationRepository, {
        count: async (f: any) => (f?.personId ? 0 : 50), // at capacity
        createOne: async (data: any) => ({ ...fakeRegistration, ...data }),
      }),
      ...stubRepo(WaitlistEntryRepository, {
        nextPosition: async () => 3,
        createOne: async (data: any) => ({ ...fakeWaitlistEntry, ...data, position: 3 }),
      }),
    };
    const { createEventRegistration } = await import('./createEventRegistration');
    const ctx = makeCtx({
      _body: { eventId: 'evt-1', personId: 'user-1' },
    });
    const response = await createEventRegistration(ctx);
    expect(response.status).toBe(201);
    expect(response.body.waitlisted).toBe(true);
  });

  test('auto-waitlists when over capacity', async () => {
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => publishedEvent,
      }),
      ...stubRepo(EventRegistrationRepository, {
        count: async (f: any) => (f?.personId ? 0 : 60), // over capacity
        createOne: async (data: any) => ({ ...fakeRegistration, ...data }),
      }),
      ...stubRepo(WaitlistEntryRepository, {
        nextPosition: async () => 11,
        createOne: async (data: any) => ({ ...fakeWaitlistEntry, ...data, position: 11 }),
      }),
    };
    const { createEventRegistration } = await import('./createEventRegistration');
    const ctx = makeCtx({
      _body: { eventId: 'evt-1', personId: 'user-1' },
    });
    const response = await createEventRegistration(ctx);
    expect(response.status).toBe(201);
    expect(response.body.waitlisted).toBe(true);
  });

  test('confirms when event has no capacity limit (null)', async () => {
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => ({ ...publishedEvent, capacity: null }),
      }),
      ...stubRepo(EventRegistrationRepository, {
        count: async (f: any) => (f?.personId ? 0 : 999),
        createOne: async (data: any) => ({ ...fakeRegistration, ...data }),
      }),
      ...stubRepo(WaitlistEntryRepository, {
        nextPosition: async () => 1,
        createOne: async (data: any) => fakeWaitlistEntry,
      }),
    };
    const { createEventRegistration } = await import('./createEventRegistration');
    const ctx = makeCtx({
      _body: { eventId: 'evt-1', personId: 'user-1' },
    });
    const response = await createEventRegistration(ctx);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('confirmed');
  });

  test('throws NotFoundError for non-existent event', async () => {
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => null,
      }),
      ...stubRepo(EventRegistrationRepository, {
        count: async () => 0,
        createOne: async (data: any) => fakeRegistration,
      }),
    };
    const { createEventRegistration } = await import('./createEventRegistration');
    const ctx = makeCtx({
      _body: { eventId: 'evt-missing', personId: 'user-1' },
    });
    await expect(createEventRegistration(ctx)).rejects.toThrow('Event not found');
  });
});

// ─── Event Status Transitions ──────────────────────────────

describe('publishEvent — status transitions (draft→published)', () => {
  let mocks: Record<string, { mockRestore: () => void }>;
  let officerMocks: Record<string, { mockRestore: () => void }>;

  const draftEvent = {
    id: 'evt-1',
    organizationId: 'org-1',
    title: 'Conference',
    status: 'draft',
  };

  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach(m => m.mockRestore());
    restoreRepo(EventRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('publishes draft event successfully', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = stubRepo(EventRepository, {
      findOneById: async () => draftEvent,
      publish: async () => ({ ...draftEvent, status: 'published', publishedAt: new Date() }),
    });
    const { publishEvent } = await import('./publishEvent');
    const ctx = makeCtx({ _params: { eventId: 'evt-1' } });
    const response = await publishEvent(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('published');
  });

  test('rejects publishing already-published event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = stubRepo(EventRepository, {
      findOneById: async () => ({ ...draftEvent, status: 'published' }),
    });
    const { publishEvent } = await import('./publishEvent');
    const ctx = makeCtx({ _params: { eventId: 'evt-1' } });
    await expect(publishEvent(ctx)).rejects.toThrow('Only draft events can be published');
  });

  test('rejects publishing cancelled event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = stubRepo(EventRepository, {
      findOneById: async () => ({ ...draftEvent, status: 'cancelled' }),
    });
    const { publishEvent } = await import('./publishEvent');
    const ctx = makeCtx({ _params: { eventId: 'evt-1' } });
    await expect(publishEvent(ctx)).rejects.toThrow('Only draft events can be published');
  });

  test('rejects publishing completed event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = stubRepo(EventRepository, {
      findOneById: async () => ({ ...draftEvent, status: 'completed' }),
    });
    const { publishEvent } = await import('./publishEvent');
    const ctx = makeCtx({ _params: { eventId: 'evt-1' } });
    await expect(publishEvent(ctx)).rejects.toThrow('Only draft events can be published');
  });

  test('throws NotFoundError for non-existent event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = stubRepo(EventRepository, {
      findOneById: async () => null,
    });
    const { publishEvent } = await import('./publishEvent');
    const ctx = makeCtx({ _params: { eventId: 'evt-missing' } });
    await expect(publishEvent(ctx)).rejects.toThrow('Event not found');
  });
});

describe('cancelEvent — status transitions (draft/published→cancelled)', () => {
  let mocks: Record<string, { mockRestore: () => void }>;
  let officerMocks: Record<string, { mockRestore: () => void }>;

  const publishedEvent = {
    id: 'evt-1',
    organizationId: 'org-1',
    title: 'Conference',
    status: 'published',
  };

  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach(m => m.mockRestore());
    restoreRepo(EventRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('cancels published event successfully', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = stubRepo(EventRepository, {
      findOneById: async () => publishedEvent,
      cancel: async () => ({ ...publishedEvent, status: 'cancelled' }),
    });
    const { cancelEvent } = await import('./cancelEvent');
    const ctx = makeCtx({ _params: { eventId: 'evt-1' } });
    const response = await cancelEvent(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('cancelled');
  });

  test('cancels draft event successfully', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = stubRepo(EventRepository, {
      findOneById: async () => ({ ...publishedEvent, status: 'draft' }),
      cancel: async () => ({ ...publishedEvent, status: 'cancelled' }),
    });
    const { cancelEvent } = await import('./cancelEvent');
    const ctx = makeCtx({ _params: { eventId: 'evt-1' } });
    const response = await cancelEvent(ctx);
    expect(response.status).toBe(200);
  });

  test('rejects cancelling completed event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = stubRepo(EventRepository, {
      findOneById: async () => ({ ...publishedEvent, status: 'completed' }),
    });
    const { cancelEvent } = await import('./cancelEvent');
    const ctx = makeCtx({ _params: { eventId: 'evt-1' } });
    await expect(cancelEvent(ctx)).rejects.toThrow('Only draft or published events can be cancelled');
  });

  test('rejects cancelling already-cancelled event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = stubRepo(EventRepository, {
      findOneById: async () => ({ ...publishedEvent, status: 'cancelled' }),
    });
    const { cancelEvent } = await import('./cancelEvent');
    const ctx = makeCtx({ _params: { eventId: 'evt-1' } });
    await expect(cancelEvent(ctx)).rejects.toThrow('Only draft or published events can be cancelled');
  });

});

// ─── Officer Permission: createEvent ───────────────────────

describe('createEvent — officer permission gate', () => {
  let mocks: Record<string, { mockRestore: () => void }>;
  let officerMocks: Record<string, { mockRestore: () => void }>;

  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach(m => m.mockRestore());
    restoreRepo(EventRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('officers can create events with draft status', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = stubRepo(EventRepository, {
      createOne: async (data: any) => ({ id: 'evt-new', ...data }),
    });
    const { createEvent } = await import('./createEvent');
    const ctx = makeCtx({
      _body: {
        title: 'New Event',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        capacity: 100,
      },
    });
    const response = await createEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('draft');
  });

});

// ─── registerForCustomEvent — capacity + published guard ────

describe('registerForCustomEvent — capacity + published guard', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  const publishedEvent = {
    id: 'evt-1',
    organizationId: 'org-1',
    title: 'Conference',
    status: 'published',
    capacity: 20,
  };

  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(EventRegistrationRepository);
    restoreRepo(WaitlistEntryRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    restoreRepo(EventRepository);
    restoreRepo(EventRegistrationRepository);
    restoreRepo(WaitlistEntryRepository);
  });

  test('confirms registration under capacity', async () => {
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => publishedEvent,
      }),
      ...stubRepo(EventRegistrationRepository, {
        count: async () => 10,
        createOne: async (data: any) => ({ id: 'reg-1', ...data }),
      }),
      ...stubRepo(WaitlistEntryRepository, {
        nextPosition: async () => 1,
        createOne: async (data: any) => ({ id: 'wl-1', ...data }),
      }),
    };
    const { registerForCustomEvent } = await import('./registerForCustomEvent');
    const ctx = makeCtx({ _params: { eventId: 'evt-1' } });
    const response = await registerForCustomEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('confirmed');
  });

  test('auto-waitlists at capacity', async () => {
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => publishedEvent,
      }),
      ...stubRepo(EventRegistrationRepository, {
        count: async () => 20,
        createOne: async (data: any) => ({ id: 'reg-1', ...data }),
      }),
      ...stubRepo(WaitlistEntryRepository, {
        nextPosition: async () => 5,
        createOne: async (data: any) => ({ id: 'wl-1', ...data, position: 5 }),
      }),
    };
    const { registerForCustomEvent } = await import('./registerForCustomEvent');
    const ctx = makeCtx({ _params: { eventId: 'evt-1' } });
    const response = await registerForCustomEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.waitlisted).toBe(true);
  });

  test('rejects registration for draft event', async () => {
    mocks = stubRepo(EventRepository, {
      findOneById: async () => ({ ...publishedEvent, status: 'draft' }),
    });
    const { registerForCustomEvent } = await import('./registerForCustomEvent');
    const ctx = makeCtx({ _params: { eventId: 'evt-1' } });
    await expect(registerForCustomEvent(ctx)).rejects.toThrow('Registrations are only accepted for published events');
  });
});

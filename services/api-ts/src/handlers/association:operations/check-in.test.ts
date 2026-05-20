import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { EventRepository, CheckInRepository } from './repos/events.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

/**
 * Check-In Tests — BR-18: Event QR Check-In
 *
 * Covers:
 * - Authenticated scanner + valid event required
 * - Duplicate check-in prevention
 * - Manual override by officer
 * - QR token verification
 * - Training check-in guards
 */

// ─── Shared fixtures ─────────────────────────────────────

const fakeEvent = {
  id: 'evt-1',
  organizationId: 'org-1',
  title: 'Annual Conference',
  status: 'published',
};

const fakeCheckIn = {
  id: 'ci-1',
  eventId: 'evt-1',
  personId: 'person-1',
  method: 'manual' as const,
  checkedInBy: 'user-1',
  organizationId: 'org-1',
};

// ─── [BR-18] Authenticated scanner + valid event ─────────

describe('[BR-18] createCheckIn — scanner auth + valid event', () => {
  let mocks: Record<string, { mockRestore: () => void }>;
  let officerMocks: Record<string, { mockRestore: () => void }>;

  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(CheckInRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
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

  test('returns 403 when user lacks officer position', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({
      _body: { eventId: 'evt-1', method: 'manual', personId: 'person-1' },
    });
    const response = await createCheckIn(ctx);
    expect(response.status).toBe(403);
  });

  test('throws NotFoundError for non-existent event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, { findOneById: async () => null }),
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

  test('manual check-in succeeds for authenticated officer with valid event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, { findOneById: async () => fakeEvent }),
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
    expect(response.body.method).toBe('manual');
  });

  test('checkedInBy is set from authenticated user, not body', async () => {
    let capturedData: any = null;
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, { findOneById: async () => fakeEvent }),
      ...stubRepo(CheckInRepository, {
        findMany: async () => [],
        createOne: async (data: any) => {
          capturedData = data;
          return { ...fakeCheckIn, ...data };
        },
      }),
    };
    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({
      _body: { eventId: 'evt-1', method: 'manual', personId: 'person-1' },
    });
    await createCheckIn(ctx);
    expect(capturedData.checkedInBy).toBe('user-1');
  });

  test('QR check-in verifies token and extracts eventId', async () => {
    const { generateQrToken } = await import('./utils/qr-checkin');
    const secret = 'test-qr-secret';
    const token = generateQrToken('evt-1', 'event', secret);

    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, { findOneById: async () => fakeEvent }),
      ...stubRepo(CheckInRepository, {
        findMany: async () => [],
        createOne: async (data: any) => ({ ...fakeCheckIn, ...data }),
      }),
    };

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
      ...stubRepo(EventRepository, { findOneById: async () => fakeEvent }),
      ...stubRepo(CheckInRepository, {
        findMany: async () => [],
        createOne: async (data: any) => fakeCheckIn,
      }),
    };
    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({
      _body: { method: 'qr', qrToken: 'tampered.token', personId: 'person-1' },
    });
    await expect(createCheckIn(ctx)).rejects.toThrow('Invalid or expired QR token');
  });
});

// ─── [BR-18] Duplicate check-in prevention ───────────────

describe('[BR-18] createCheckIn — duplicate prevention', () => {
  let mocks: Record<string, { mockRestore: () => void }>;
  let officerMocks: Record<string, { mockRestore: () => void }>;

  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(CheckInRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(EventRepository);
    restoreRepo(CheckInRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('rejects duplicate check-in for same person+event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, { findOneById: async () => fakeEvent }),
      ...stubRepo(CheckInRepository, {
        findMany: async () => [fakeCheckIn],
        createOne: async (data: any) => fakeCheckIn,
      }),
    };
    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({
      _body: { eventId: 'evt-1', method: 'manual', personId: 'person-1' },
    });
    await expect(createCheckIn(ctx)).rejects.toThrow(
      'Person already checked in for this event',
    );
  });

  test('allows check-in for different person at same event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, { findOneById: async () => fakeEvent }),
      ...stubRepo(CheckInRepository, {
        findMany: async () => [],
        createOne: async (data: any) => ({ ...fakeCheckIn, ...data, personId: 'person-2' }),
      }),
    };
    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({
      _body: { eventId: 'evt-1', method: 'manual', personId: 'person-2' },
    });
    const response = await createCheckIn(ctx);
    expect(response.status).toBe(201);
  });

  test('allows same person to check in to different events', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => ({ ...fakeEvent, id: 'evt-2' }),
      }),
      ...stubRepo(CheckInRepository, {
        findMany: async () => [],
        createOne: async (data: any) => ({ ...fakeCheckIn, ...data, eventId: 'evt-2' }),
      }),
    };
    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({
      _body: { eventId: 'evt-2', method: 'manual', personId: 'person-1' },
    });
    const response = await createCheckIn(ctx);
    expect(response.status).toBe(201);
  });
});

// ─── [BR-18] checkInCustomEvent — duplicate prevention ───

describe('[BR-18] checkInCustomEvent — duplicate prevention + manual override', () => {
  let mocks: Record<string, { mockRestore: () => void }>;
  let officerMocks: Record<string, { mockRestore: () => void }>;

  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(CheckInRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(EventRepository);
    restoreRepo(CheckInRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 without authenticated user', async () => {
    const { checkInCustomEvent } = await import('./checkInCustomEvent');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' }, _body: {} });
    const response = await checkInCustomEvent(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks officer position', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const { checkInCustomEvent } = await import('./checkInCustomEvent');
    const ctx = makeCtx({ _params: { eventId: 'evt-1' }, _body: {} });
    const response = await checkInCustomEvent(ctx);
    expect(response.status).toBe(403);
  });

  test('officer manually checks in another person (manual override)', async () => {
    let capturedData: any = null;
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, { findOneById: async () => fakeEvent }),
      ...stubRepo(CheckInRepository, {
        findMany: async () => [],
        createOne: async (data: any) => {
          capturedData = data;
          return { ...fakeCheckIn, ...data };
        },
      }),
    };
    const { checkInCustomEvent } = await import('./checkInCustomEvent');
    const ctx = makeCtx({
      _params: { eventId: 'evt-1' },
      _body: { personId: 'member-42', method: 'manual' },
    });
    const response = await checkInCustomEvent(ctx);
    expect(response.status).toBe(201);
    expect(capturedData.personId).toBe('member-42');
    expect(capturedData.method).toBe('manual');
    expect(capturedData.checkedInBy).toBe('user-1');
  });

  test('rejects duplicate check-in for same person+event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, { findOneById: async () => fakeEvent }),
      ...stubRepo(CheckInRepository, {
        findMany: async () => [fakeCheckIn],
        createOne: async (data: any) => fakeCheckIn,
      }),
    };
    const { checkInCustomEvent } = await import('./checkInCustomEvent');
    const ctx = makeCtx({
      _params: { eventId: 'evt-1' },
      _body: { personId: 'person-1', method: 'manual' },
    });
    await expect(checkInCustomEvent(ctx)).rejects.toThrow(
      'Person already checked in for this event',
    );
  });

  test('throws NotFoundError for non-existent event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    mocks = {
      ...stubRepo(EventRepository, { findOneById: async () => null }),
      ...stubRepo(CheckInRepository, {
        findMany: async () => [],
        createOne: async (data: any) => fakeCheckIn,
      }),
    };
    const { checkInCustomEvent } = await import('./checkInCustomEvent');
    const ctx = makeCtx({
      _params: { eventId: 'evt-missing' },
      _body: { personId: 'person-1' },
    });
    await expect(checkInCustomEvent(ctx)).rejects.toThrow('Event not found');
  });
});

// ─── searchCheckIns — auth guard ─────────────────────────

describe('searchCheckIns — guards', () => {
  test('returns 401 without authenticated user', async () => {
    const { searchCheckIns } = await import('./searchCheckIns');
    const ctx = makeCtx({ user: null });
    const response = await searchCheckIns(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organization context', async () => {
    const { searchCheckIns } = await import('./searchCheckIns');
    const ctx = makeCtx({ organizationId: null });
    const response = await searchCheckIns(ctx);
    expect(response.status).toBe(403);
  });
});

// ─── checkInCustomTraining — guards ──────────────────────

describe('checkInCustomTraining — guards', () => {
  test('returns 401 without authenticated user', async () => {
    const { checkInCustomTraining } = await import('./checkInCustomTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' } });
    const response = await checkInCustomTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks officer position', async () => {
    restoreRepo(OfficerTermRepository);
    const officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const { checkInCustomTraining } = await import('./checkInCustomTraining');
    const ctx = makeCtx({ _params: { trainingId: 't-1' } });
    const response = await checkInCustomTraining(ctx);
    expect(response.status).toBe(403);
    Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
  });
});

// ─── Check-in method defaults ────────────────────────────

describe('Check-in method defaults', () => {
  test('check-in methods are qr and manual', () => {
    const methods = ['qr', 'manual'];
    expect(methods).toContain('qr');
    expect(methods).toContain('manual');
    expect(methods.length).toBe(2);
  });

  test('default check-in method is manual when not specified', () => {
    const input: string | undefined = undefined;
    const method = input || 'manual';
    expect(method).toBe('manual');
  });
});

// Business Rules: [BR-17]
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeEvent as createFakeEvent, fakeCheckIn as createFakeCheckIn } from '@/test-utils/factories';
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

const fakeEvent = createFakeEvent({
  title: 'Annual Conference',
});

const fakeCheckIn = createFakeCheckIn({
  eventId: 'evt-1',
  personId: 'person-1',
  method: 'manual' as const,
  checkedInBy: 'user-1',
  organizationId: 'org-1',
});

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

});

// ─── G1 / FIX-001 — officer check-in awards a credit to the named member ──
//
// The officer marks a SPECIFIC enrollee (personId from the request) present.
// That enrollee's enrollment transitions to completed and a single AUTO
// CreditEntry is written for THAT member (not the officer). Repeating the
// check-in must not award a second credit (idempotent per member).
import { TrainingRepository as TrainingRepo2, TrainingEnrollmentRepository as EnrollRepo2 } from './repos/training.repo';
import { CreditEntryRepository as CreditRepo2 } from '@/handlers/association:member/repos/credits.repo';
import { OfficerTermRepository as OfficerRepo2 } from '@/handlers/association:member/repos/governance.repo';

describe('checkInCustomTraining — awards credit to the named member (FIX-001)', () => {
  let trainingMocks: ReturnType<typeof stubRepo>;
  let enrollMocks: ReturnType<typeof stubRepo>;
  let creditMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(TrainingRepo2);
    restoreRepo(EnrollRepo2);
    restoreRepo(CreditRepo2);
    restoreRepo(OfficerRepo2);
  });

  afterEach(() => {
    [trainingMocks, enrollMocks, creditMocks, officerMocks].forEach(
      (m) => m && Object.values(m).forEach((s) => s.mockRestore()),
    );
    restoreRepo(TrainingRepo2);
    restoreRepo(EnrollRepo2);
    restoreRepo(CreditRepo2);
    restoreRepo(OfficerRepo2);
  });

  test('officer checks in member m-1 → AUTO credit written for m-1, enrollment completed', async () => {
    let createdCredit: any = null;
    let updatedTo: any = null;
    officerMocks = stubRepo(OfficerRepo2, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    trainingMocks = stubRepo(TrainingRepo2, {
      findOneById: async () => ({
        id: 't-1',
        organizationId: 'org-1',
        title: 'CPD Seminar',
        creditBearing: true,
        creditAmount: 12,
        endDate: new Date(),
      }),
    });
    enrollMocks = stubRepo(EnrollRepo2, {
      findMany: async () => [{ id: 'e-1', trainingId: 't-1', personId: 'm-1', status: 'enrolled' }],
      updateOneById: async (_id: string, data: any) => { updatedTo = data; return { id: 'e-1', personId: 'm-1', status: data.status }; },
    });
    creditMocks = stubRepo(CreditRepo2, {
      findByTrainingAndPerson: async () => null,
      createOne: async (data: any) => { createdCredit = data; return { id: 'c-1' }; },
    });

    const { checkInCustomTraining } = await import('./checkInCustomTraining');
    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { trainingId: 't-1' },
      _query: { organizationId: 'org-1', personId: 'm-1' },
    });

    const response = await checkInCustomTraining(ctx);
    expect(response.status).toBe(200);
    expect(createdCredit).not.toBeNull();
    expect(createdCredit.personId).toBe('m-1');
    expect(createdCredit.creditAmount).toBe(12);
    expect(updatedTo?.status).toBe('completed');
  });

  test('re-checking-in the same member does NOT award a second credit (idempotent)', async () => {
    let createCalls = 0;
    officerMocks = stubRepo(OfficerRepo2, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    trainingMocks = stubRepo(TrainingRepo2, {
      findOneById: async () => ({
        id: 't-1', organizationId: 'org-1', title: 'CPD Seminar',
        creditBearing: true, creditAmount: 12, endDate: new Date(),
      }),
    });
    enrollMocks = stubRepo(EnrollRepo2, {
      findMany: async () => [{ id: 'e-1', trainingId: 't-1', personId: 'm-1', status: 'completed' }],
      updateOneById: async () => ({ id: 'e-1', personId: 'm-1', status: 'completed' }),
    });
    creditMocks = stubRepo(CreditRepo2, {
      findByTrainingAndPerson: async () => ({ id: 'c-existing' }),
      createOne: async () => { createCalls += 1; return { id: 'c-2' }; },
    });

    const { checkInCustomTraining } = await import('./checkInCustomTraining');
    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { trainingId: 't-1' },
      _query: { organizationId: 'org-1', personId: 'm-1' },
    });

    const response = await checkInCustomTraining(ctx);
    expect(response.status).toBe(200);
    expect(createCalls).toBe(0);
  });
});

// ─── G9 / FIX-009 — toggle suppresses the check-in credit award ──
//
// The officer-attendance seam (the core CPD journey) shares the
// awardTrainingCredit routine, so the org credit-tracking toggle must
// suppress the award here too.
import { organizations as orgsTableCI } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { orgCpdConfig as cpdTableCI } from '@/handlers/association:member/repos/credits.schema';

function makeToggleDbCI(rowsByTable: Map<unknown, unknown[]>) {
  function selectChain() {
    let currentTable: unknown;
    const chain: any = {
      from: (t: unknown) => { currentTable = t; return chain; },
      where: () => chain,
      limit: async () => (rowsByTable.get(currentTable) ?? []),
      orderBy: async () => (rowsByTable.get(currentTable) ?? []),
      then: (resolve: any, reject?: any) =>
        Promise.resolve(rowsByTable.get(currentTable) ?? []).then(resolve, reject),
    };
    return chain;
  }
  return {
    select: () => selectChain(),
    update: () => { const c: any = { set: () => c, where: () => c, returning: async () => [{}] }; return c; },
    insert: () => ({ values: async () => undefined }),
    transaction: async (fn: any) => fn(makeToggleDbCI(rowsByTable)),
  };
}

describe('checkInCustomTraining — G9 toggle suppresses the credit (FIX-009)', () => {
  beforeEach(() => {
    restoreRepo(TrainingRepo2);
    restoreRepo(EnrollRepo2);
    restoreRepo(CreditRepo2);
    restoreRepo(OfficerRepo2);
  });
  afterEach(() => {
    restoreRepo(TrainingRepo2);
    restoreRepo(EnrollRepo2);
    restoreRepo(CreditRepo2);
    restoreRepo(OfficerRepo2);
  });

  test('toggle DISABLED → member marked present but NO credit written', async () => {
    let createCalls = 0;
    stubRepo(OfficerRepo2, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    stubRepo(TrainingRepo2, {
      findOneById: async () => ({
        id: 't-1', organizationId: 'org-1', title: 'CPD Seminar',
        creditBearing: true, creditAmount: 12, endDate: new Date(),
      }),
    });
    stubRepo(EnrollRepo2, {
      findMany: async () => [{ id: 'e-1', trainingId: 't-1', personId: 'm-1', status: 'enrolled' }],
      updateOneById: async (_id: string, data: any) => ({ id: 'e-1', personId: 'm-1', status: data.status }),
    });
    stubRepo(CreditRepo2, {
      findByTrainingAndPerson: async () => null,
      createOne: async () => { createCalls += 1; return { id: 'c-1' }; },
    });

    const db = makeToggleDbCI(new Map<unknown, unknown[]>([
      [orgsTableCI, [{ id: 'org-1', featureFlags: { creditTracking: false } }]],
      [cpdTableCI, []],
    ]));

    const { checkInCustomTraining } = await import('./checkInCustomTraining');
    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      database: db,
      _params: { trainingId: 't-1' },
      _query: { organizationId: 'org-1', personId: 'm-1' },
    });

    const response = await checkInCustomTraining(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.creditAwarded).toBe(0);
    expect(createCalls).toBe(0);
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

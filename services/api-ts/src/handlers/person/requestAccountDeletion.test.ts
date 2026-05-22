/**
 * Tests for requestAccountDeletion + cancelAccountDeletion + executeAccountDeletion
 *
 * BR-32: Financial records retained 7 years with anonymized identifier.
 * M-25: Account deletion with 30-day grace period.
 * DPA 2012: Right to be forgotten with retention exceptions.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakePerson as createFakePerson } from '@/test-utils/factories';
import { requestAccountDeletion } from './requestAccountDeletion';
import { cancelAccountDeletion } from './cancelAccountDeletion';
import { executeAccountDeletion } from './executeAccountDeletion';
import { PersonRepository } from './repos/person.repo';
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const fakePerson = createFakePerson({
  specialization: 'Orthodontics',
  prcId: '123456',
  avatar: { url: 'https://example.com/avatar.jpg' },
  languagesSpoken: ['en', 'tl'],
  deletionRequestedAt: null,
  deletionScheduledAt: null,
  deletionCompletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// ─── requestAccountDeletion ─────────────────────────────────

describe('requestAccountDeletion', () => {
  let mocks: any;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m: any) => m.mockRestore?.());
  });

  test('returns 200 with deletionScheduledAt 30 days from now', async () => {
    let capturedUpdate: any;
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ ...fakePerson }),
      updateOneById: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...fakePerson, ...data };
      },
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    const before = Date.now();
    const response = await requestAccountDeletion(ctx);
    const after = Date.now();

    expect(response.status).toBe(200);
    expect(response.body.gracePeriodDays).toBe(30);

    const scheduled = new Date(response.body.deletionScheduledAt).getTime();
    expect(scheduled).toBeGreaterThanOrEqual(before + THIRTY_DAYS_MS - 1000);
    expect(scheduled).toBeLessThanOrEqual(after + THIRTY_DAYS_MS + 1000);

    expect(capturedUpdate.deletionRequestedAt).toBeDefined();
    expect(capturedUpdate.deletionScheduledAt).toBeDefined();
  });

  test('returns 401 when no session', async () => {
    const ctx = makeCtx({ user: null });
    const response = await requestAccountDeletion(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 409 when deletion already requested', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({
        ...fakePerson,
        deletionRequestedAt: new Date(),
        deletionScheduledAt: new Date(Date.now() + THIRTY_DAYS_MS),
      }),
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    const response = await requestAccountDeletion(ctx);
    expect(response.status).toBe(409);
  });

  test('returns 404 when person not found', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    const response = await requestAccountDeletion(ctx);
    expect(response.status).toBe(404);
  });
});

// ─── cancelAccountDeletion ──────────────────────────────────

describe('cancelAccountDeletion', () => {
  let mocks: any;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m: any) => m.mockRestore?.());
  });

  test('clears deletion fields during grace period', async () => {
    let capturedUpdate: any;
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({
        ...fakePerson,
        deletionRequestedAt: new Date(),
        deletionScheduledAt: new Date(Date.now() + THIRTY_DAYS_MS),
      }),
      updateOneById: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...fakePerson, ...data };
      },
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    const response = await cancelAccountDeletion(ctx);

    expect(response.status).toBe(200);
    expect(capturedUpdate.deletionRequestedAt).toBeNull();
    expect(capturedUpdate.deletionScheduledAt).toBeNull();
  });

  test('returns 401 when no session', async () => {
    const ctx = makeCtx({ user: null });
    const response = await cancelAccountDeletion(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 400 when no deletion pending', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ ...fakePerson }),
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    const response = await cancelAccountDeletion(ctx);
    expect(response.status).toBe(400);
  });

  test('returns 410 when deletion already executed', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({
        ...fakePerson,
        deletionCompletedAt: new Date(),
      }),
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    const response = await cancelAccountDeletion(ctx);
    expect(response.status).toBe(410);
  });
});

// ─── executeAccountDeletion ─────────────────────────────────

// Shared db mock for executeAccountDeletion tests — supports delete for session cleanup + update for payment anonymization
const execMockDb = {
  transaction: async (fn: any) => fn({}),
  delete: () => ({ where: async () => [] }),
  update: () => ({ set: () => ({ where: async () => [] }) }),
};

describe('executeAccountDeletion', () => {
  let mocks: any;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m: any) => m.mockRestore?.());
  });

  test('anonymizes person PII fields', async () => {
    let capturedUpdate: any;
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({
        ...fakePerson,
        deletionRequestedAt: new Date(Date.now() - THIRTY_DAYS_MS - 1000),
        deletionScheduledAt: new Date(Date.now() - 1000),
      }),
      updateOneById: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...fakePerson, ...data };
      },
    });

    const ctx = makeCtx({ _params: { personId: 'user-1' }, database: execMockDb });
    const response = await executeAccountDeletion(ctx);

    expect(response.status).toBe(200);
    expect(capturedUpdate.firstName).toBe('DELETED');
    expect(capturedUpdate.lastName).toBe('DELETED');
    expect(capturedUpdate.middleName).toBeNull();
    expect(capturedUpdate.contactInfo).toEqual({ email: 'deleted@deleted.invalid', phone: undefined });
    expect(capturedUpdate.primaryAddress).toBeNull();
    expect(capturedUpdate.avatar).toBeNull();
    expect(capturedUpdate.licenseNumber).toBeNull();
    expect(capturedUpdate.specialization).toBeNull();
    expect(capturedUpdate.prcId).toBeNull();
    expect(capturedUpdate.dateOfBirth).toBeNull();
    expect(capturedUpdate.languagesSpoken).toBeNull();
    expect(capturedUpdate.deletionCompletedAt).toBeDefined();
  });

  test('retains person ID (not deleted) for payment reference [BR-32]', async () => {
    let capturedUpdate: any;
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({
        ...fakePerson,
        deletionRequestedAt: new Date(Date.now() - THIRTY_DAYS_MS - 1000),
        deletionScheduledAt: new Date(Date.now() - 1000),
      }),
      updateOneById: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...fakePerson, ...data };
      },
    });

    const ctx = makeCtx({ _params: { personId: 'user-1' }, database: execMockDb });
    await executeAccountDeletion(ctx);

    // Person record updated (anonymized), NOT deleted
    // ID preserved so payment records can still reference it
    expect(capturedUpdate).toBeDefined();
    expect(capturedUpdate.firstName).toBe('DELETED');
    // No delete call should have been made
  });

  test('audit details during executeAccountDeletion do not contain PII (DPA-05)', async () => {
    const auditCalls: any[] = [];
    const fakeAudit = {
      logEvent: async (args: any) => {
        auditCalls.push(args);
      },
    };

    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({
        ...fakePerson,
        deletionRequestedAt: new Date(Date.now() - THIRTY_DAYS_MS - 1000),
        deletionScheduledAt: new Date(Date.now() - 1000),
      }),
      updateOneById: async (_id: string, data: any) => ({ ...fakePerson, ...data }),
    });

    const ctx = makeCtx({ _params: { personId: 'user-1' }, audit: fakeAudit, database: execMockDb });
    await executeAccountDeletion(ctx);

    expect(auditCalls.length).toBeGreaterThanOrEqual(1);
    const details = auditCalls[0]?.details ?? {};
    // Must NOT contain PII fields
    expect(details.firstName).toBeUndefined();
    expect(details.lastName).toBeUndefined();
    expect(details.email).toBeUndefined();
    expect(details.phone).toBeUndefined();
    expect(details.contactInfo).toBeUndefined();
    // Must only contain safe fields
    expect(details.originalRequestDate).toBeDefined();
  });

  test('rejects if grace period not yet expired', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({
        ...fakePerson,
        deletionRequestedAt: new Date(),
        deletionScheduledAt: new Date(Date.now() + THIRTY_DAYS_MS),
      }),
    });

    const ctx = makeCtx({ _params: { personId: 'user-1' } });
    const response = await executeAccountDeletion(ctx);
    expect(response.status).toBe(400);
  });

  test('rejects if already deleted', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({
        ...fakePerson,
        deletionCompletedAt: new Date(),
      }),
    });

    const ctx = makeCtx({ _params: { personId: 'user-1' } });
    const response = await executeAccountDeletion(ctx);
    expect(response.status).toBe(410);
  });

  test('rejects if no deletion was requested', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ ...fakePerson }),
    });

    const ctx = makeCtx({ _params: { personId: 'user-1' } });
    const response = await executeAccountDeletion(ctx);
    expect(response.status).toBe(400);
  });
});

/**
 * Pagination ceiling tests for association:operations list* handlers.
 *
 * Guards against unbounded SELECTs (audit finding: "6 unbounded list*
 * handlers"). Each fixed handler must:
 *   (a) apply a sane DEFAULT page size when the caller supplies no limit,
 *   (b) CLAMP an over-max requested limit to the shared MAX_PAGE_SIZE.
 *
 * Strategy: stub the repo method the handler calls with a spy that records
 * the pagination it received, then assert on the captured limit.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeEnrollment, fakeEvent, fakeRegistration } from '@/test-utils/factories';
import { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from '@/core/pagination';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
import { EventRepository, EventRegistrationRepository, CheckInRepository } from './repos/events.repo';
import { AccreditedProviderRepository } from './repos/accredited-provider.repo';
import { CommitteeRepository } from './repos/committee.repo';

// Captures the pagination arg the handler forwards to the repo.
function capturePagination() {
  const calls: Array<{ limit?: number; offset?: number } | undefined> = [];
  const record = (options?: { pagination?: { limit: number; offset: number } }) => {
    calls.push(options?.pagination);
  };
  return { calls, record };
}

// ═══════════════════════════════════════════════════════════
// listMyCustomTrainings
// ═══════════════════════════════════════════════════════════

describe('listMyCustomTrainings — limit ceiling', () => {
  let mocks: ReturnType<typeof stubRepo>;
  beforeEach(() => restoreRepo(TrainingEnrollmentRepository));
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(TrainingEnrollmentRepository);
  });

  test('applies DEFAULT_PAGE_SIZE when no limit supplied', async () => {
    const cap = capturePagination();
    mocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async (_filters: unknown, options: any) => {
        cap.record(options);
        return [fakeEnrollment({ id: 'e-1', personId: 'user-1' })];
      },
    });
    const { listMyCustomTrainings } = await import('./listMyCustomTrainings');
    const res = await listMyCustomTrainings(makeCtx({ _query: {} }));
    expect(res.status).toBe(200);
    expect(cap.calls[0]?.limit).toBe(DEFAULT_PAGE_SIZE);
  });

  test('clamps over-max requested limit to MAX_PAGE_SIZE', async () => {
    const cap = capturePagination();
    mocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async (_filters: unknown, options: any) => {
        cap.record(options);
        return [];
      },
    });
    const { listMyCustomTrainings } = await import('./listMyCustomTrainings');
    const res = await listMyCustomTrainings(makeCtx({ _query: { limit: 999999 } }));
    expect(res.status).toBe(200);
    expect(cap.calls[0]?.limit).toBe(MAX_PAGE_SIZE);
  });
});

// ═══════════════════════════════════════════════════════════
// listCustomTrainingEnrollments
// ═══════════════════════════════════════════════════════════

describe('listCustomTrainingEnrollments — limit ceiling', () => {
  let mocks: ReturnType<typeof stubRepo>;
  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
  });
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
  });

  function setup(cap: ReturnType<typeof capturePagination>) {
    return {
      ...stubRepo(TrainingRepository, { findOneById: async () => ({ id: 'tr-1' }) }),
      ...stubRepo(TrainingEnrollmentRepository, {
        findMany: async (_f: unknown, options: any) => {
          cap.record(options);
          return [];
        },
      }),
    };
  }

  test('applies DEFAULT_PAGE_SIZE when no limit supplied', async () => {
    const cap = capturePagination();
    mocks = setup(cap);
    const { listCustomTrainingEnrollments } = await import('./listCustomTrainingEnrollments');
    const res = await listCustomTrainingEnrollments(makeCtx({ _params: { trainingId: 'tr-1' }, _query: {} }));
    expect(res.status).toBe(200);
    expect(cap.calls[0]?.limit).toBe(DEFAULT_PAGE_SIZE);
  });

  test('clamps over-max requested limit to MAX_PAGE_SIZE', async () => {
    const cap = capturePagination();
    mocks = setup(cap);
    const { listCustomTrainingEnrollments } = await import('./listCustomTrainingEnrollments');
    const res = await listCustomTrainingEnrollments(makeCtx({ _params: { trainingId: 'tr-1' }, _query: { limit: 100000 } }));
    expect(res.status).toBe(200);
    expect(cap.calls[0]?.limit).toBe(MAX_PAGE_SIZE);
  });
});

// ═══════════════════════════════════════════════════════════
// listCustomEventRegistrations
// ═══════════════════════════════════════════════════════════

describe('listCustomEventRegistrations — limit ceiling', () => {
  let mocks: ReturnType<typeof stubRepo>;
  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(EventRegistrationRepository);
  });
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(EventRepository);
    restoreRepo(EventRegistrationRepository);
  });

  function setup(cap: ReturnType<typeof capturePagination>) {
    return {
      ...stubRepo(EventRepository, { findOneById: async () => fakeEvent({ id: 'evt-1' }) }),
      ...stubRepo(EventRegistrationRepository, {
        findMany: async (_f: unknown, options: any) => {
          cap.record(options);
          return [fakeRegistration({ id: 'r-1', eventId: 'evt-1' })];
        },
      }),
    };
  }

  test('applies DEFAULT_PAGE_SIZE when no limit supplied', async () => {
    const cap = capturePagination();
    mocks = setup(cap);
    const { listCustomEventRegistrations } = await import('./listCustomEventRegistrations');
    const res = await listCustomEventRegistrations(makeCtx({ _params: { eventId: 'evt-1' }, _query: {} }));
    expect(res.status).toBe(200);
    expect(cap.calls[0]?.limit).toBe(DEFAULT_PAGE_SIZE);
  });

  test('clamps over-max requested limit to MAX_PAGE_SIZE', async () => {
    const cap = capturePagination();
    mocks = setup(cap);
    const { listCustomEventRegistrations } = await import('./listCustomEventRegistrations');
    const res = await listCustomEventRegistrations(makeCtx({ _params: { eventId: 'evt-1' }, _query: { limit: 5000 } }));
    expect(res.status).toBe(200);
    expect(cap.calls[0]?.limit).toBe(MAX_PAGE_SIZE);
  });
});

// ═══════════════════════════════════════════════════════════
// listCustomEventAttendance
// ═══════════════════════════════════════════════════════════

describe('listCustomEventAttendance — limit ceiling', () => {
  let mocks: ReturnType<typeof stubRepo>;
  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(CheckInRepository);
  });
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(EventRepository);
    restoreRepo(CheckInRepository);
  });

  function setup(cap: ReturnType<typeof capturePagination>) {
    return {
      ...stubRepo(EventRepository, { findOneById: async () => fakeEvent({ id: 'evt-1' }) }),
      ...stubRepo(CheckInRepository, {
        findMany: async (_f: unknown, options: any) => {
          cap.record(options);
          return [];
        },
      }),
    };
  }

  test('applies DEFAULT_PAGE_SIZE when no limit supplied', async () => {
    const cap = capturePagination();
    mocks = setup(cap);
    const { listCustomEventAttendance } = await import('./listCustomEventAttendance');
    const res = await listCustomEventAttendance(makeCtx({ _params: { eventId: 'evt-1' }, _query: {} }));
    expect(res.status).toBe(200);
    expect(cap.calls[0]?.limit).toBe(DEFAULT_PAGE_SIZE);
  });

  test('clamps over-max requested limit to MAX_PAGE_SIZE', async () => {
    const cap = capturePagination();
    mocks = setup(cap);
    const { listCustomEventAttendance } = await import('./listCustomEventAttendance');
    const res = await listCustomEventAttendance(makeCtx({ _params: { eventId: 'evt-1' }, _query: { limit: 9000 } }));
    expect(res.status).toBe(200);
    expect(cap.calls[0]?.limit).toBe(MAX_PAGE_SIZE);
  });
});

// ═══════════════════════════════════════════════════════════
// listOrgAccreditedProviders (custom unbounded repo method)
// ═══════════════════════════════════════════════════════════

describe('listOrgAccreditedProviders — limit ceiling', () => {
  let mocks: ReturnType<typeof stubRepo>;
  beforeEach(() => restoreRepo(AccreditedProviderRepository));
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(AccreditedProviderRepository);
  });

  test('applies DEFAULT_PAGE_SIZE when no limit supplied', async () => {
    let capturedLimit: number | undefined;
    mocks = stubRepo(AccreditedProviderRepository, {
      listWithExpiry: async (_org: string, _status: unknown, pagination: any) => {
        capturedLimit = pagination?.limit;
        return { data: [], total: 0 };
      },
    });
    const { listOrgAccreditedProviders } = await import('./listOrgAccreditedProviders');
    const res = await listOrgAccreditedProviders(makeCtx({ _params: { organizationId: 'org-1' } }));
    expect(res.status).toBe(200);
    expect(capturedLimit).toBe(DEFAULT_PAGE_SIZE);
  });

  test('clamps over-max requested limit to MAX_PAGE_SIZE', async () => {
    let capturedLimit: number | undefined;
    mocks = stubRepo(AccreditedProviderRepository, {
      listWithExpiry: async (_org: string, _status: unknown, pagination: any) => {
        capturedLimit = pagination?.limit;
        return { data: [], total: 0 };
      },
    });
    const ctx = makeCtx({ _params: { organizationId: 'org-1' }, _query: { limit: 99999 } });
    const { listOrgAccreditedProviders } = await import('./listOrgAccreditedProviders');
    const res = await listOrgAccreditedProviders(ctx);
    expect(res.status).toBe(200);
    expect(capturedLimit).toBe(MAX_PAGE_SIZE);
  });
});

// ═══════════════════════════════════════════════════════════
// listCommittees (hardcoded .limit, now caller-clampable)
// ═══════════════════════════════════════════════════════════

describe('listCommittees — limit ceiling', () => {
  let mocks: ReturnType<typeof stubRepo>;
  beforeEach(() => restoreRepo(CommitteeRepository));
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(CommitteeRepository);
  });

  test('applies DEFAULT_PAGE_SIZE when no limit supplied', async () => {
    let capturedLimit: number | undefined;
    mocks = stubRepo(CommitteeRepository, {
      list: async (_org: string, pagination: any) => {
        capturedLimit = pagination?.limit;
        return [];
      },
    });
    const { listCommittees } = await import('./listCommittees');
    const res = await listCommittees(makeCtx({ _params: { organizationId: 'org-1' } }));
    expect(res.status).toBe(200);
    expect(capturedLimit).toBe(DEFAULT_PAGE_SIZE);
  });

  test('clamps over-max requested limit to MAX_PAGE_SIZE', async () => {
    let capturedLimit: number | undefined;
    mocks = stubRepo(CommitteeRepository, {
      list: async (_org: string, pagination: any) => {
        capturedLimit = pagination?.limit;
        return [];
      },
    });
    const ctx = makeCtx({ _params: { organizationId: 'org-1' }, _query: { limit: 12345 } });
    const { listCommittees } = await import('./listCommittees');
    const res = await listCommittees(ctx);
    expect(res.status).toBe(200);
    expect(capturedLimit).toBe(MAX_PAGE_SIZE);
  });
});

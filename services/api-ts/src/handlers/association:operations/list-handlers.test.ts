import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeEnrollment, fakeEvent, fakeRegistration } from '@/test-utils/factories';
import { TrainingEnrollmentRepository } from './repos/training.repo';
import { EventRepository, EventRegistrationRepository } from './repos/events.repo';

/**
 * List Handlers Tests
 *
 * Tests for list/my-items handlers that return user-scoped or
 * entity-scoped collections.
 */

// ═══════════════════════════════════════════════════════════════════════════
// listMyCustomTrainings
// ═══════════════════════════════════════════════════════════════════════════

describe('listMyCustomTrainings', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(TrainingEnrollmentRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    restoreRepo(TrainingEnrollmentRepository);
  });

  test('returns 401 without user', async () => {
    const { listMyCustomTrainings } = await import('./listMyCustomTrainings');
    const ctx = makeCtx({ user: null });
    const response = await listMyCustomTrainings(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 200 with user enrollments', async () => {
    const enrollments = [
      fakeEnrollment({ id: 'enr-1', trainingId: 'tr-1', personId: 'user-1', status: 'enrolled' }),
      fakeEnrollment({ id: 'enr-2', trainingId: 'tr-2', personId: 'user-1', status: 'completed' }),
    ];
    mocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => enrollments,
    });
    const { listMyCustomTrainings } = await import('./listMyCustomTrainings');
    const ctx = makeCtx({ _query: {} });
    const response = await listMyCustomTrainings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(2);
    expect(response.body.total).toBe(2);
  });

  test('returns 200 with empty list when no enrollments', async () => {
    mocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => [],
    });
    const { listMyCustomTrainings } = await import('./listMyCustomTrainings');
    const ctx = makeCtx({ _query: {} });
    const response = await listMyCustomTrainings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.total).toBe(0);
  });

  test('filters by status when provided', async () => {
    const enrollments = [
      fakeEnrollment({ id: 'enr-1', trainingId: 'tr-1', personId: 'user-1', status: 'completed' }),
    ];
    mocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => enrollments,
    });
    const { listMyCustomTrainings } = await import('./listMyCustomTrainings');
    const ctx = makeCtx({ _query: { status: 'completed' } });
    const response = await listMyCustomTrainings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// listCustomEventRegistrations
// ═══════════════════════════════════════════════════════════════════════════

describe('listCustomEventRegistrations', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(EventRegistrationRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    restoreRepo(EventRepository);
    restoreRepo(EventRegistrationRepository);
  });

  test('returns 401 without user', async () => {
    const { listCustomEventRegistrations } = await import('./listCustomEventRegistrations');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' } });
    const response = await listCustomEventRegistrations(ctx);
    expect(response.status).toBe(401);
  });

  test('throws NotFoundError for non-existent event', async () => {
    mocks = stubRepo(EventRepository, {
      findOneById: async () => null,
    });
    const { listCustomEventRegistrations } = await import('./listCustomEventRegistrations');
    const ctx = makeCtx({ _params: { eventId: 'evt-missing' } });
    await expect(listCustomEventRegistrations(ctx)).rejects.toThrow('Event not found');
  });

  test('returns 200 with registrations for valid event', async () => {
    const evt = fakeEvent({ id: 'evt-1', title: 'Conference', status: 'published', organizationId: 'org-1' });
    const regs = [
      fakeRegistration({ id: 'reg-1', eventId: 'evt-1', personId: 'p-1', status: 'confirmed' }),
      fakeRegistration({ id: 'reg-2', eventId: 'evt-1', personId: 'p-2', status: 'confirmed' }),
    ];
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => evt,
      }),
      ...stubRepo(EventRegistrationRepository, {
        findMany: async () => regs,
      }),
    };
    const { listCustomEventRegistrations } = await import('./listCustomEventRegistrations');
    const ctx = makeCtx({ _params: { eventId: 'evt-1' }, _query: {} });
    const response = await listCustomEventRegistrations(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(2);
    expect(response.body.total).toBe(2);
  });

  test('returns 200 with empty list when no registrations', async () => {
    const evt = fakeEvent({ id: 'evt-1', title: 'Conference', status: 'published', organizationId: 'org-1' });
    mocks = {
      ...stubRepo(EventRepository, {
        findOneById: async () => evt,
      }),
      ...stubRepo(EventRegistrationRepository, {
        findMany: async () => [],
      }),
    };
    const { listCustomEventRegistrations } = await import('./listCustomEventRegistrations');
    const ctx = makeCtx({ _params: { eventId: 'evt-1' }, _query: {} });
    const response = await listCustomEventRegistrations(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.total).toBe(0);
  });
});

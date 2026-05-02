import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { enroll } from './enroll';
import { TrainingRepository } from './repos/training.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';

const fakeTraining = {
  id: 'training-1',
  tenantId: 'org-1',
  organizationId: 'org-1',
  title: 'CPD Seminar',
  status: 'published',
  capacity: 50,
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-02'),
};

const fakeEnrollment = {
  id: 'enroll-1',
  tenantId: 'org-1',
  trainingId: 'training-1',
  personId: 'user-1',
  status: 'enrolled',
  enrolledAt: new Date(),
  completedAt: null,
  cancelledAt: null,
};

describe('enroll', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('enrolls user and returns 201', async () => {
    mocks = stubRepo(TrainingRepository, {
      get: async () => fakeTraining,
      getEnrollmentCount: async () => 10,
      enroll: async (data: any) => ({ ...fakeEnrollment, ...data }),
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'training-1' } });
    const response = await enroll(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('enrolled');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('sets status to cancelled when at capacity (waitlist behavior)', async () => {
    let capturedData: any;
    mocks = stubRepo(TrainingRepository, {
      get: async () => ({ ...fakeTraining, capacity: 20 }),
      getEnrollmentCount: async () => 20,
      enroll: async (data: any) => { capturedData = data; return { ...fakeEnrollment, ...data }; },
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'training-1' } });
    const response = await enroll(ctx);
    expect(response.status).toBe(201);
    expect(capturedData.status).toBe('cancelled');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('enrolls normally when capacity is null (unlimited)', async () => {
    let capturedData: any;
    mocks = stubRepo(TrainingRepository, {
      get: async () => ({ ...fakeTraining, capacity: null }),
      getEnrollmentCount: async () => 999,
      enroll: async (data: any) => { capturedData = data; return { ...fakeEnrollment, ...data }; },
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'training-1' } });
    const response = await enroll(ctx);
    expect(response.status).toBe(201);
    expect(capturedData.status).toBe('enrolled');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('throws NotFoundError when training does not exist', async () => {
    mocks = stubRepo(TrainingRepository, {
      get: async () => undefined,
      getEnrollmentCount: async () => 0,
      enroll: async (data: any) => fakeEnrollment,
    });

    const ctx = makeCtx({ _params: { id: 'missing-id' } });
    await expect(enroll(ctx)).rejects.toThrow('Training not found');
  });

  test('enrolls in cancelled training (no training status guard)', async () => {
    mocks = stubRepo(TrainingRepository, {
      get: async () => ({ ...fakeTraining, status: 'cancelled' }),
      getEnrollmentCount: async () => 0,
      enroll: async (data: any) => ({ ...fakeEnrollment, ...data }),
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'training-1' } });
    const response = await enroll(ctx);
    expect(response.status).toBe(201);
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('does not guard against duplicate enrollment', async () => {
    mocks = stubRepo(TrainingRepository, {
      get: async () => fakeTraining,
      getEnrollmentCount: async () => 10,
      enroll: async (data: any) => ({ ...fakeEnrollment, ...data, id: 'enroll-2' }),
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'training-1' } });
    const response = await enroll(ctx);
    expect(response.status).toBe(201);
    Object.values(mm).forEach(m => m.mockRestore());
  });

  // ─── [BR-02] Grace Period Enrollment Guard ────────────────

  test('[BR-02] blocks grace period member from enrolling', async () => {
    mocks = stubRepo(TrainingRepository, {
      get: async () => fakeTraining,
      getEnrollmentCount: async () => 0,
      enroll: async (data: any) => fakeEnrollment,
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'gracePeriod' }) });

    const ctx = makeCtx({ _params: { id: 'training-1' } });
    await expect(enroll(ctx)).rejects.toThrow('Active membership required');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('[BR-02] blocks suspended member from enrolling', async () => {
    mocks = stubRepo(TrainingRepository, {
      get: async () => fakeTraining,
      getEnrollmentCount: async () => 0,
      enroll: async (data: any) => fakeEnrollment,
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'suspended' }) });

    const ctx = makeCtx({ _params: { id: 'training-1' } });
    await expect(enroll(ctx)).rejects.toThrow('Active membership required');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('[BR-02] blocks non-member from enrolling', async () => {
    mocks = stubRepo(TrainingRepository, {
      get: async () => fakeTraining,
      getEnrollmentCount: async () => 0,
      enroll: async (data: any) => fakeEnrollment,
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => null });

    const ctx = makeCtx({ _params: { id: 'training-1' } });
    await expect(enroll(ctx)).rejects.toThrow('Active membership required');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(TrainingRepository, {
      get: async () => fakeTraining,
      getEnrollmentCount: async () => 0,
      enroll: async (data: any) => fakeEnrollment,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'training-1' },
    });

    await expect(enroll(ctx)).rejects.toThrow();
  });
});

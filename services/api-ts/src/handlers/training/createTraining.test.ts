import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { createTraining } from './createTraining';
import { TrainingRepository } from './repos/training.repo';

const fakeTraining = {
  id: 'training-1',
  organizationId: 'org-1',
  organizationId: 'org-1',
  title: 'CPD Seminar',
  description: 'Dental CPD',
  instructorName: 'Dr. Santos',
  location: 'Manila Hotel',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-02'),
  capacity: 50,
  registrationFee: 5000,
  creditBearing: true,
  creditAmount: 8,
  status: 'draft',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

describe('[BR-15] createTraining', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('creates training and returns 201', async () => {
    mocks = stubRepo(TrainingRepository, {
      create: async (data: any) => ({ ...fakeTraining, ...data }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'CPD Seminar',
        description: 'Dental CPD',
        instructorName: 'Dr. Santos',
        location: 'Manila Hotel',
        startAt: '2026-06-01',
        endAt: '2026-06-02',
        fee: 5000,
        capacity: 50,
        creditBearing: true,
        creditValue: 8,
      },
    });

    const response = await createTraining(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.title).toBe('CPD Seminar');
    expect(response.body.data.organizationId).toBe('org-1');
  });

  test('sets createdBy and updatedBy from session', async () => {
    let capturedData: any;
    mocks = stubRepo(TrainingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeTraining, ...data }; },
    });

    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'admin' },
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'Test',
        startAt: '2026-06-01',
        endAt: '2026-06-02',
      },
    });

    await createTraining(ctx);
    expect(capturedData.createdBy).toBe('admin-1');
    expect(capturedData.updatedBy).toBe('admin-1');
  });

  test('defaults status to draft when not provided', async () => {
    let capturedData: any;
    mocks = stubRepo(TrainingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeTraining, ...data }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'Test',
        startAt: '2026-06-01',
        endAt: '2026-06-02',
      },
    });

    await createTraining(ctx);
    expect(capturedData.status).toBe('draft');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(TrainingRepository, {
      create: async (data: any) => ({ ...fakeTraining, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'Test',
        startAt: '2026-06-01',
        endAt: '2026-06-02',
      },
    });

    // session.user.id is accessed for createdBy/updatedBy
    await expect(createTraining(ctx)).rejects.toThrow();
  });

  // --- PRC-01: PRC accreditation fields ---

  test('[PRC-01] stores prcAccreditationNumber and accreditedProviderId', async () => {
    let capturedData: any;
    mocks = stubRepo(TrainingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeTraining, ...data }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'PRC Training',
        startAt: '2026-06-01',
        endAt: '2026-06-02',
        prcAccreditationNumber: 'PRC-CPD-2026-001',
        accreditedProviderId: 'provider-uuid-1',
      },
    });

    const response = await createTraining(ctx);
    expect(response.status).toBe(201);
    expect(capturedData.prcAccreditationNumber).toBe('PRC-CPD-2026-001');
    expect(capturedData.accreditedProviderId).toBe('provider-uuid-1');
  });

  test('[PRC-01] backward compatible — works without PRC fields', async () => {
    let capturedData: any;
    mocks = stubRepo(TrainingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeTraining, ...data }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'Non-PRC Training',
        startAt: '2026-06-01',
        endAt: '2026-06-02',
      },
    });

    const response = await createTraining(ctx);
    expect(response.status).toBe(201);
    expect(capturedData.prcAccreditationNumber).toBeUndefined();
    expect(capturedData.accreditedProviderId).toBeUndefined();
  });
});

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { updateTraining } from './updateTraining';
import { TrainingRepository } from './repos/training.repo';

const fakeTraining = {
  id: 'training-1',
  orgId: 'org-1',
  orgId: 'org-1',
  title: 'CPD Seminar',
  status: 'draft',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-02'),
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

describe('updateTraining', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('updates training and returns 200', async () => {
    const updated = { ...fakeTraining, title: 'Updated Seminar' };
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      update: async (_id: string, data: any) => ({ ...fakeTraining, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', orgId: 'org-1' },
      _body: { title: 'Updated Seminar' },
    });

    const response = await updateTraining(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe('Updated Seminar');
  });

  test('throws NotFoundError when training does not exist', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => undefined,
      update: async () => fakeTraining,
    });

    const ctx = makeCtx({
      _params: { id: 'missing-id', orgId: 'org-1' },
      _body: { title: 'Test' },
    });

    await expect(updateTraining(ctx)).rejects.toThrow('Training not found');
  });

  test('maps startAt to startDate', async () => {
    let capturedData: any;
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeTraining, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', orgId: 'org-1' },
      _body: { startAt: '2026-07-01' },
    });

    await updateTraining(ctx);
    expect(capturedData.startDate).toBeInstanceOf(Date);
  });

  test('maps fee to registrationFee', async () => {
    let capturedData: any;
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeTraining, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', orgId: 'org-1' },
      _body: { fee: 7500 },
    });

    await updateTraining(ctx);
    expect(capturedData.registrationFee).toBe(7500);
  });

  test('sets updatedBy from session', async () => {
    let capturedData: any;
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeTraining, ...data }; },
    });

    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'admin' },
      _params: { id: 'training-1', orgId: 'org-1' },
      _body: { title: 'Test' },
    });

    await updateTraining(ctx);
    expect(capturedData.updatedBy).toBe('admin-1');
  });

  test('throws STATUS_UPDATE_NOT_ALLOWED if status provided in body', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      update: async (_id: string, data: any) => ({ ...fakeTraining, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', orgId: 'org-1' },
      _body: { title: 'Updated', status: 'published' },
    });

    await expect(updateTraining(ctx)).rejects.toMatchObject({ code: 'STATUS_UPDATE_NOT_ALLOWED' });
  });

  test('does not pass status to repo when status not in body', async () => {
    let capturedData: any = null;
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeTraining, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', orgId: 'org-1' },
      _body: { title: 'Safe Update' },
    });

    await updateTraining(ctx);
    expect(capturedData.status).toBeUndefined();
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      update: async () => fakeTraining,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'training-1', orgId: 'org-1' },
      _body: { title: 'Test' },
    });

    await expect(updateTraining(ctx)).rejects.toThrow();
  });

  // --- SO-8: Regulatory approval maintenance ---

  test('[SO-8] updates regulatory approval status', async () => {
    let capturedData: any;
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeTraining, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', orgId: 'org-1' },
      _body: {
        regulatoryApproval: 'prc_approved',
        regulatoryReference: 'PRC-CPD-2026-001',
      },
    });

    const response = await updateTraining(ctx);
    expect(response.status).toBe(200);
    expect(capturedData.regulatoryApproval).toBe('prc_approved');
    expect(capturedData.regulatoryReference).toBe('PRC-CPD-2026-001');
  });

  test('[SO-8] updates regulatory expiration date', async () => {
    let capturedData: any;
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeTraining, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', orgId: 'org-1' },
      _body: {
        regulatoryApproval: 'prc_approved',
        regulatoryExpiresAt: '2027-12-31',
      },
    });

    const response = await updateTraining(ctx);
    expect(response.status).toBe(200);
    expect(capturedData.regulatoryExpiresAt).toBeInstanceOf(Date);
  });

  test('[SO-8] updates basic and regulatory fields together', async () => {
    let capturedData: any;
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeTraining, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', orgId: 'org-1' },
      _body: {
        title: 'Updated With Approval',
        regulatoryApproval: 'pending_approval',
      },
    });

    const response = await updateTraining(ctx);
    expect(response.status).toBe(200);
    expect(capturedData.title).toBe('Updated With Approval');
    expect(capturedData.regulatoryApproval).toBe('pending_approval');
  });
});

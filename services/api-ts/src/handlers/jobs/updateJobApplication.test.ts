/**
 * [M15] updateJobApplication handler tests
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { updateJobApplication } from './updateJobApplication';
import { JobApplicationRepository } from './repos/jobs.repo';

const now = new Date('2026-06-01T00:00:00Z');

const fakeApplication = {
  id: 'app-1',
  postingId: 'job-1',
  personId: 'member-1',
  resumeRef: 'storage://resume-1.pdf',
  coverLetter: 'I am very interested...',
  appliedAt: now,
  status: 'applied' as const,
  createdBy: 'member-1',
  updatedBy: 'member-1',
  createdAt: now,
  updatedAt: now,
  version: 1,
};

describe('[M15] updateJobApplication', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns 200 with status change', async () => {
    mocks = stubRepo(JobApplicationRepository, {
      get: async () => fakeApplication,
      update: async (_id: string, data: any) => ({ ...fakeApplication, ...data }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
      _body: { status: 'screening' },
    });

    const response = await updateJobApplication(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('screening');
    expect(response.body.data.id).toBe('app-1');
  });

  test('returns 404 for non-existent application', async () => {
    mocks = stubRepo(JobApplicationRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { applicationId: 'missing' },
      _body: { status: 'screening' },
    });

    const response = await updateJobApplication(ctx);
    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
  });

  test('can transition to hired', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobApplicationRepository, {
      get: async () => fakeApplication,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeApplication, ...data }; },
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
      _body: { status: 'hired' },
    });

    await updateJobApplication(ctx);
    expect(capturedData.status).toBe('hired');
  });

  test('can transition to withdrawn', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobApplicationRepository, {
      get: async () => fakeApplication,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeApplication, ...data }; },
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
      _body: { status: 'withdrawn' },
    });

    await updateJobApplication(ctx);
    expect(capturedData.status).toBe('withdrawn');
  });

  test('can transition to rejected', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobApplicationRepository, {
      get: async () => fakeApplication,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeApplication, ...data }; },
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
      _body: { status: 'rejected' },
    });

    await updateJobApplication(ctx);
    expect(capturedData.status).toBe('rejected');
  });
});

describe('[M15] updateJobApplication status lifecycle', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  const statusTransitions = [
    ['applied', 'screening'],
    ['screening', 'interviewed'],
    ['interviewed', 'offered'],
    ['offered', 'hired'],
    ['applied', 'rejected'],
    ['screening', 'rejected'],
    ['applied', 'withdrawn'],
    ['screening', 'withdrawn'],
    ['interviewed', 'withdrawn'],
    ['offered', 'withdrawn'],
  ] as const;

  for (const [from, to] of statusTransitions) {
    test(`can transition from ${from} to ${to}`, async () => {
      let capturedData: any = null;
      mocks = stubRepo(JobApplicationRepository, {
        get: async () => ({ ...fakeApplication, status: from }),
        update: async (_id: string, data: any) => { capturedData = data; return { ...fakeApplication, ...data }; },
      });

      const ctx = makeCtx({
        _params: { applicationId: 'app-1' },
        _body: { status: to },
      });

      const response = await updateJobApplication(ctx);
      expect(response.status).toBe(200);
      expect(capturedData.status).toBe(to);
    });
  }
});

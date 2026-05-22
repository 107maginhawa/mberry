/**
 * [M15] updateJobPosting handler tests
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeJobPosting as createFakeJobPosting } from '@/test-utils/factories';
import { updateJobPosting } from './updateJobPosting';
import { JobPostingRepository } from './repos/jobs.repo';

const now = new Date('2026-06-01T00:00:00Z');
const thirtyDaysLater = new Date('2026-07-01T00:00:00Z');

const fakePosting = createFakeJobPosting({
  title: 'Senior Engineer',
  organizationName: 'Acme Corp',
  type: 'full_time' as const,
  status: 'active' as const,
  expiresAt: thirtyDaysLater,
  postedBy: 'user-1',
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: now,
  updatedAt: now,
  version: 1,
});

describe('[M15] updateJobPosting', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns 200 with updated data', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => fakePosting,
      update: async (_id: string, data: any) => ({ ...fakePosting, ...data }),
    });

    const ctx = makeCtx({
      _params: { postingId: 'job-1' },
      _body: { title: 'Updated Title' },
    });

    const response = await updateJobPosting(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe('Updated Title');
    expect(response.body.data.id).toBe('job-1');
  });

  test('returns 404 for non-existent posting', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { postingId: 'missing' },
      _body: { title: 'Updated' },
    });

    const response = await updateJobPosting(ctx);
    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
  });

  test('sets updatedBy from session', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      get: async () => fakePosting,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      _params: { postingId: 'job-1' },
      _body: { status: 'active' },
    });

    await updateJobPosting(ctx);
    expect(capturedData.updatedBy).toBe('user-1');
  });

  test('can change status to closed', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      get: async () => fakePosting,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      _params: { postingId: 'job-1' },
      _body: { status: 'closed' },
    });

    await updateJobPosting(ctx);
    expect(capturedData.status).toBe('closed');
  });

  test('can change status to filled', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      get: async () => fakePosting,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      _params: { postingId: 'job-1' },
      _body: { status: 'filled' },
    });

    await updateJobPosting(ctx);
    expect(capturedData.status).toBe('filled');
  });

  test('can extend expiresAt', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      get: async () => fakePosting,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      _params: { postingId: 'job-1' },
      _body: { expiresAt: '2026-12-31' },
    });

    await updateJobPosting(ctx);
    expect(capturedData.expiresAt).toEqual(new Date('2026-12-31'));
  });

  test('requires authenticated session', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => fakePosting,
      update: async (_id: string, data: any) => ({ ...fakePosting, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { postingId: 'job-1' },
      _body: { title: 'Updated' },
    });

    await expect(updateJobPosting(ctx)).rejects.toThrow();
  });
});

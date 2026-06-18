/**
 * [M15] createJobApplication handler tests
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeJobPosting as createFakeJobPosting } from '@/test-utils/factories';
import { createJobApplication } from './createJobApplication';
import { JobPostingRepository, JobApplicationRepository } from './repos/jobs.repo';

const now = new Date('2026-06-01T00:00:00Z');

const fakePosting = createFakeJobPosting({
  title: 'Senior Engineer',
  organizationName: 'Acme Corp',
  type: 'full_time' as const,
  status: 'active' as const,
  expiresAt: new Date('2026-07-01T00:00:00Z'),
  postedBy: 'user-1',
  createdAt: now,
  updatedAt: now,
  version: 1,
});

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

describe('[M15] createJobApplication', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let mocks2: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (mocks2) Object.values(mocks2).forEach((m) => m.mockRestore());
  });

  test('returns 201 for valid application', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => ({ ...fakePosting, status: 'active' }),
    });
    mocks2 = stubRepo(JobApplicationRepository, {
      findByPersonAndPosting: async () => undefined,
      create: async (data: any) => ({ ...fakeApplication, ...data }),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        postingId: 'job-1',
        coverLetter: 'I am interested',
        resumeRef: 'storage://resume.pdf',
      },
    });

    const response = await createJobApplication(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.postingId).toBe('job-1');
    expect(response.body.data.status).toBe('applied');
  });

  test('rejects missing postingId with 400', async () => {
    const ctx = makeCtx({ _body: {} });
    const response = await createJobApplication(ctx);
    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  test('returns 404 for non-existent posting', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({ _body: { postingId: 'missing-job' } });
    const response = await createJobApplication(ctx);
    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
  });

  test('rejects application to non-active posting with 409', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => ({ ...fakePosting, status: 'draft' }),
    });

    const ctx = makeCtx({ organizationId: 'org-1', _body: { postingId: 'job-1' } });
    const response = await createJobApplication(ctx);
    expect(response.status).toBe(409);
    expect(response.body.error).toContain('not accepting');
  });

  test('rejects application to expired posting with 409', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => ({
        ...fakePosting,
        status: 'active',
        expiresAt: new Date('2020-01-01'),
      }),
    });
    mocks2 = stubRepo(JobApplicationRepository, {
      findByPersonAndPosting: async () => undefined,
    });

    const ctx = makeCtx({ organizationId: 'org-1', _body: { postingId: 'job-1' } });
    const response = await createJobApplication(ctx);
    expect(response.status).toBe(409);
    expect(response.body.error).toContain('expired');
  });

  test('prevents duplicate applications with 409', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => ({ ...fakePosting, status: 'active' }),
    });
    mocks2 = stubRepo(JobApplicationRepository, {
      findByPersonAndPosting: async () => fakeApplication,
    });

    const ctx = makeCtx({ organizationId: 'org-1', _body: { postingId: 'job-1' } });
    const response = await createJobApplication(ctx);
    expect(response.status).toBe(409);
    expect(response.body.error).toContain('already applied');
  });

  test('sets personId from session', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      get: async () => ({ ...fakePosting, status: 'active' }),
    });
    mocks2 = stubRepo(JobApplicationRepository, {
      findByPersonAndPosting: async () => undefined,
      create: async (data: any) => { capturedData = data; return { ...fakeApplication, ...data }; },
    });

    const ctx = makeCtx({ organizationId: 'org-1', _body: { postingId: 'job-1' } });
    await createJobApplication(ctx);
    expect(capturedData.personId).toBe('user-1');
    expect(capturedData.status).toBe('applied');
  });

  test('crashes without session', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => ({ ...fakePosting, status: 'active' }),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      user: null,
      session: null,
      _body: { postingId: 'job-1' },
    });

    await expect(createJobApplication(ctx)).rejects.toThrow();
  });
});

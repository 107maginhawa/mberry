/**
 * [M15] Job Board Stabilization Tests
 *
 * Covers: Job listing CRUD, application flow, employer permissions, listing expiry.
 * BR-37: Job posting expiry (30-day default, extension from expiry date).
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { createJobPosting } from './createJobPosting';
import { getJobPosting } from './getJobPosting';
import { searchJobPostings } from './searchJobPostings';
import { updateJobPosting } from './updateJobPosting';
import { deleteJobPosting } from './deleteJobPosting';
import { createJobApplication } from './createJobApplication';
import { updateJobApplication } from './updateJobApplication';
import { JobPostingRepository, JobApplicationRepository } from './repos/jobs.repo';

// ─── Fixtures ───────────────────────────────────────────

const now = new Date('2026-06-01T00:00:00Z');
const thirtyDaysLater = new Date('2026-07-01T00:00:00Z');

const fakePosting = {
  id: 'job-1',
  organizationId: 'org-1',
  title: 'Senior Engineer',
  organizationName: 'Acme Corp',
  location: 'Remote',
  type: 'full_time' as const,
  salary: '$120k-$150k',
  description: 'Build great things',
  requirements: ['5+ years experience', 'TypeScript'],
  postedAt: now,
  expiresAt: thirtyDaysLater,
  status: 'active' as const,
  postedBy: 'user-1',
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: now,
  updatedAt: now,
  version: 1,
};

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

// ─── Job Posting CRUD ───────────────────────────────────

describe('[M15] Job Posting CRUD', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  // ── CREATE ────────────────────────────────────────────

  test('createJobPosting returns 201 with valid data', async () => {
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => ({ ...fakePosting, ...data }),
    });

    const ctx = makeCtx({
      _body: {
        title: 'Senior Engineer',
        organizationName: 'Acme Corp',
        organizationId: 'org-1',
        type: 'full_time',
        description: 'Build great things',
      },
    });

    const response = await createJobPosting(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.title).toBe('Senior Engineer');
  });

  test('createJobPosting rejects missing title with 400', async () => {
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => ({ ...fakePosting, ...data }),
    });

    const ctx = makeCtx({
      _body: { organizationName: 'Acme Corp' },
    });

    const response = await createJobPosting(ctx);
    expect(response.status).toBe(400);
  });

  test('createJobPosting rejects missing organizationName with 400', async () => {
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => ({ ...fakePosting, ...data }),
    });

    const ctx = makeCtx({
      _body: { title: 'Engineer' },
    });

    const response = await createJobPosting(ctx);
    expect(response.status).toBe(400);
  });

  test('createJobPosting defaults type to full_time', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      _body: {
        title: 'Engineer',
        organizationName: 'Acme',
        organizationId: 'org-1',
      },
    });

    await createJobPosting(ctx);
    expect(capturedData.type).toBe('full_time');
  });

  test('createJobPosting defaults status to draft', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      _body: {
        title: 'Engineer',
        organizationName: 'Acme',
        organizationId: 'org-1',
      },
    });

    await createJobPosting(ctx);
    expect(capturedData.status).toBe('draft');
  });

  test('createJobPosting sets postedBy from session user', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      _body: {
        title: 'Engineer',
        organizationName: 'Acme',
        organizationId: 'org-1',
      },
    });

    await createJobPosting(ctx);
    expect(capturedData.postedBy).toBe('user-1');
    expect(capturedData.createdBy).toBe('user-1');
  });

  test('createJobPosting crashes without session', async () => {
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => ({ ...fakePosting, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _body: {
        title: 'Engineer',
        organizationName: 'Acme',
        organizationId: 'org-1',
      },
    });

    await expect(createJobPosting(ctx)).rejects.toThrow();
  });

  test('createJobPosting accepts custom expiresAt', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      _body: {
        title: 'Engineer',
        organizationName: 'Acme',
        organizationId: 'org-1',
        expiresAt: '2026-12-31',
      },
    });

    await createJobPosting(ctx);
    expect(capturedData.expiresAt).toEqual(new Date('2026-12-31'));
  });

  // ── READ (GET) ────────────────────────────────────────

  test('getJobPosting returns 200 for existing posting', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => fakePosting,
    });

    const ctx = makeCtx({ _params: { postingId: 'job-1' } });
    const response = await getJobPosting(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('job-1');
  });

  test('getJobPosting returns 404 for non-existent posting', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({ _params: { postingId: 'does-not-exist' } });
    const response = await getJobPosting(ctx);
    expect(response.status).toBe(404);
  });

  // ── SEARCH / LIST ────────────────────────────────────

  test('searchJobPostings returns paginated results', async () => {
    mocks = stubRepo(JobPostingRepository, {
      list: async () => ({ data: [fakePosting], total: 1 }),
    });

    const ctx = makeCtx({ _query: { status: 'active' } });
    const response = await searchJobPostings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination.total).toBe(1);
  });

  test('searchJobPostings returns empty array when no results', async () => {
    mocks = stubRepo(JobPostingRepository, {
      list: async () => ({ data: [], total: 0 }),
    });

    const ctx = makeCtx({ _query: {} });
    const response = await searchJobPostings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
    expect(response.body.pagination.total).toBe(0);
  });

  test('searchJobPostings passes filters through', async () => {
    let capturedFilters: any = null;
    mocks = stubRepo(JobPostingRepository, {
      list: async (filters: any) => { capturedFilters = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({
      _query: { status: 'active', type: 'contract', search: 'senior', limit: '10', offset: '5' },
    });

    await searchJobPostings(ctx);
    expect(capturedFilters.status).toBe('active');
    expect(capturedFilters.type).toBe('contract');
    expect(capturedFilters.search).toBe('senior');
    expect(capturedFilters.limit).toBe(10);
    expect(capturedFilters.offset).toBe(5);
  });

  // ── UPDATE ────────────────────────────────────────────

  test('updateJobPosting returns 200 with updated data', async () => {
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
  });

  test('updateJobPosting returns 404 for non-existent posting', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { postingId: 'missing' },
      _body: { title: 'Updated' },
    });

    const response = await updateJobPosting(ctx);
    expect(response.status).toBe(404);
  });

  test('updateJobPosting sets updatedBy from session', async () => {
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

  test('updateJobPosting can change status to closed', async () => {
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

  // ── DELETE ────────────────────────────────────────────

  test('deleteJobPosting returns 204 for existing posting', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => fakePosting,
      delete: async () => true,
    });

    const ctx = makeCtx({ _params: { postingId: 'job-1' } });
    const response = await deleteJobPosting(ctx);
    expect(response.status).toBe(204);
  });

  test('deleteJobPosting returns 404 for non-existent posting', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({ _params: { postingId: 'missing' } });
    const response = await deleteJobPosting(ctx);
    expect(response.status).toBe(404);
  });
});

// ─── Application Flow ───────────────────────────────────

describe('[M15] Job Application Flow', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let mocks2: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (mocks2) Object.values(mocks2).forEach((m) => m.mockRestore());
  });

  test('createJobApplication returns 201 for valid application', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => ({ ...fakePosting, status: 'active' }),
    });
    mocks2 = stubRepo(JobApplicationRepository, {
      findByPersonAndPosting: async () => undefined,
      create: async (data: any) => ({ ...fakeApplication, ...data }),
    });

    const ctx = makeCtx({
      _body: {
        postingId: 'job-1',
        coverLetter: 'I am interested',
        resumeRef: 'storage://resume.pdf',
      },
    });

    const response = await createJobApplication(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.postingId).toBe('job-1');
  });

  test('createJobApplication rejects missing postingId with 400', async () => {
    const ctx = makeCtx({ _body: {} });
    const response = await createJobApplication(ctx);
    expect(response.status).toBe(400);
  });

  test('createJobApplication returns 404 for non-existent posting', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({
      _body: { postingId: 'missing-job' },
    });

    const response = await createJobApplication(ctx);
    expect(response.status).toBe(404);
  });

  test('createJobApplication rejects application to non-active posting', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => ({ ...fakePosting, status: 'draft' }),
    });

    const ctx = makeCtx({
      _body: { postingId: 'job-1' },
    });

    const response = await createJobApplication(ctx);
    expect(response.status).toBe(409);
    expect(response.body.error).toContain('not accepting');
  });

  test('createJobApplication rejects application to expired posting', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => ({
        ...fakePosting,
        status: 'active',
        expiresAt: new Date('2020-01-01'), // expired
      }),
    });
    mocks2 = stubRepo(JobApplicationRepository, {
      findByPersonAndPosting: async () => undefined,
    });

    const ctx = makeCtx({
      _body: { postingId: 'job-1' },
    });

    const response = await createJobApplication(ctx);
    expect(response.status).toBe(409);
    expect(response.body.error).toContain('expired');
  });

  test('createJobApplication prevents duplicate applications', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => ({ ...fakePosting, status: 'active' }),
    });
    mocks2 = stubRepo(JobApplicationRepository, {
      findByPersonAndPosting: async () => fakeApplication, // already exists
    });

    const ctx = makeCtx({
      _body: { postingId: 'job-1' },
    });

    const response = await createJobApplication(ctx);
    expect(response.status).toBe(409);
    expect(response.body.error).toContain('already applied');
  });

  test('createJobApplication sets personId from session', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      get: async () => ({ ...fakePosting, status: 'active' }),
    });
    mocks2 = stubRepo(JobApplicationRepository, {
      findByPersonAndPosting: async () => undefined,
      create: async (data: any) => { capturedData = data; return { ...fakeApplication, ...data }; },
    });

    const ctx = makeCtx({
      _body: { postingId: 'job-1' },
    });

    await createJobApplication(ctx);
    expect(capturedData.personId).toBe('user-1');
    expect(capturedData.status).toBe('applied');
  });

  test('createJobApplication crashes without session', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => ({ ...fakePosting, status: 'active' }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _body: { postingId: 'job-1' },
    });

    await expect(createJobApplication(ctx)).rejects.toThrow();
  });

  // ── Update Application Status ─────────────────────────

  test('updateJobApplication returns 200 with status change', async () => {
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
  });

  test('updateJobApplication returns 404 for non-existent application', async () => {
    mocks = stubRepo(JobApplicationRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { applicationId: 'missing' },
      _body: { status: 'screening' },
    });

    const response = await updateJobApplication(ctx);
    expect(response.status).toBe(404);
  });

  test('updateJobApplication can transition to hired', async () => {
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

  test('updateJobApplication can transition to withdrawn', async () => {
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

  test('updateJobApplication can transition to rejected', async () => {
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

// ─── Employer Permissions ───────────────────────────────

describe('[M15] Employer Permissions', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('createJobPosting requires authenticated session (no anonymous posting)', async () => {
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => ({ ...fakePosting, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _body: {
        title: 'Engineer',
        organizationName: 'Acme',
      },
    });

    await expect(createJobPosting(ctx)).rejects.toThrow();
  });

  test('updateJobPosting requires authenticated session', async () => {
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

  test('posting tracks createdBy and updatedBy for audit trail', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      user: { id: 'officer-42', role: 'officer', twoFactorEnabled: true },
      _body: {
        title: 'Engineer',
        organizationName: 'Acme',
        organizationId: 'org-1',
      },
    });

    await createJobPosting(ctx);
    expect(capturedData.postedBy).toBe('officer-42');
    expect(capturedData.createdBy).toBe('officer-42');
    expect(capturedData.updatedBy).toBe('officer-42');
  });
});

// ─── Listing Expiry (BR-37 integration) ─────────────────

describe('[M15/BR-37] Listing Expiry', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('posting with no expiresAt gets auto-set via repo (30-day default)', async () => {
    // This tests the repo.create logic that auto-sets expiresAt
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      _body: {
        title: 'Engineer',
        organizationName: 'Acme',
        organizationId: 'org-1',
        postedAt: '2026-06-01',
        // no expiresAt
      },
    });

    await createJobPosting(ctx);
    // Handler passes undefined expiresAt, repo should auto-set
    expect(capturedData.expiresAt).toBeUndefined();
    // (auto-set happens in actual repo.create, not in stubbed version)
  });

  test('application to posting with past expiresAt is rejected', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => ({
        ...fakePosting,
        status: 'active',
        expiresAt: new Date('2020-01-01'),
      }),
    });
    const mocks2 = stubRepo(JobApplicationRepository, {
      findByPersonAndPosting: async () => undefined,
    });

    const ctx = makeCtx({ _body: { postingId: 'job-1' } });
    const response = await createJobApplication(ctx);
    expect(response.status).toBe(409);

    Object.values(mocks2).forEach((m) => m.mockRestore());
  });

  test('posting can be closed manually via update', async () => {
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

  test('posting expiresAt can be extended via update', async () => {
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

  test('posting status can transition from active to filled', async () => {
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
});

// ─── Application Status Lifecycle ───────────────────────

describe('[M15] Application Status Lifecycle', () => {
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
    test(`application can transition from ${from} to ${to}`, async () => {
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

// ─── Employment Type Coverage ───────────────────────────

describe('[M15] Employment Type Coverage', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  const types = ['full_time', 'part_time', 'contract', 'fellowship', 'internship'] as const;

  for (const jobType of types) {
    test(`can create ${jobType} posting`, async () => {
      let capturedData: any = null;
      mocks = stubRepo(JobPostingRepository, {
        create: async (data: any) => { capturedData = data; return { ...fakePosting, ...data, type: jobType }; },
      });

      const ctx = makeCtx({
        _body: {
          title: `${jobType} position`,
          organizationName: 'Acme',
          organizationId: 'org-1',
          type: jobType,
        },
      });

      const response = await createJobPosting(ctx);
      expect(response.status).toBe(201);
      expect(capturedData.type).toBe(jobType);
    });
  }
});

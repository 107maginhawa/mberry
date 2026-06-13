/**
 * [M15] createJobPosting handler tests
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeJobPosting as createFakeJobPosting } from '@/test-utils/factories';
import { createJobPosting } from './createJobPosting';
import { JobPostingRepository } from './repos/jobs.repo';

const now = new Date('2026-06-01T00:00:00Z');
const thirtyDaysLater = new Date('2026-07-01T00:00:00Z');

const fakePosting = createFakeJobPosting({
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
});

describe('[M15] createJobPosting', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns 201 with valid data', async () => {
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
    expect(response.body.data.status).toBe('draft');
  });

  test('rejects missing title with 400', async () => {
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => ({ ...fakePosting, ...data }),
    });

    const ctx = makeCtx({ _body: { organizationName: 'Acme Corp' } });
    const response = await createJobPosting(ctx);
    expect(response.status).toBe(400);
  });

  test('rejects missing organizationName with 400', async () => {
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => ({ ...fakePosting, ...data }),
    });

    const ctx = makeCtx({ _body: { title: 'Engineer' } });
    const response = await createJobPosting(ctx);
    expect(response.status).toBe(400);
  });

  test('defaults type to full_time', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      _body: { title: 'Engineer', organizationName: 'Acme', organizationId: 'org-1' },
    });

    await createJobPosting(ctx);
    expect(capturedData.type).toBe('full_time');
  });

  test('defaults status to draft', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      _body: { title: 'Engineer', organizationName: 'Acme', organizationId: 'org-1' },
    });

    await createJobPosting(ctx);
    expect(capturedData.status).toBe('draft');
  });

  test('sets postedBy from session user', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      _body: { title: 'Engineer', organizationName: 'Acme', organizationId: 'org-1' },
    });

    await createJobPosting(ctx);
    expect(capturedData.postedBy).toBe('user-1');
    expect(capturedData.createdBy).toBe('user-1');
  });

  test('crashes without session', async () => {
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => ({ ...fakePosting, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _body: { title: 'Engineer', organizationName: 'Acme', organizationId: 'org-1' },
    });

    await expect(createJobPosting(ctx)).rejects.toThrow();
  });

  test('accepts custom expiresAt', async () => {
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

  test('tracks createdBy and updatedBy for audit trail', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      user: { id: 'officer-42', role: 'officer', twoFactorEnabled: true },
      _body: { title: 'Engineer', organizationName: 'Acme', organizationId: 'org-1' },
    });

    await createJobPosting(ctx);
    expect(capturedData.postedBy).toBe('officer-42');
    expect(capturedData.createdBy).toBe('officer-42');
    expect(capturedData.updatedBy).toBe('officer-42');
  });
});

describe('[M15] createJobPosting org-context trust (FIX-003)', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('binds organizationId to the tenant-resolved org from context, not body', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    // orgContextMiddleware verified the caller is a member of 'tenant-A' and set
    // ctx.var.organizationId = 'tenant-A'. The body attempts to redirect the write
    // to 'tenant-B' (cross-org write attack).
    const ctx = makeCtx({
      organizationId: 'tenant-A',
      _body: {
        title: 'Engineer',
        organizationName: 'Acme',
        organizationId: 'tenant-B',
      },
    });

    const response = await createJobPosting(ctx);
    expect(response.status).toBe(201);
    // The insert MUST use the trusted context org, never the body-supplied org.
    expect(capturedData.organizationId).toBe('tenant-A');
    expect(capturedData.organizationId).not.toBe('tenant-B');
  });

  test('uses context org even when body omits organizationId entirely', async () => {
    let capturedData: any = null;
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakePosting, ...data }; },
    });

    const ctx = makeCtx({
      organizationId: 'tenant-A',
      _body: { title: 'Engineer', organizationName: 'Acme' },
    });

    const response = await createJobPosting(ctx);
    expect(response.status).toBe(201);
    expect(capturedData.organizationId).toBe('tenant-A');
  });

  test('rejects with 403 when no org context is established', async () => {
    mocks = stubRepo(JobPostingRepository, {
      create: async (data: any) => ({ ...fakePosting, ...data }),
    });

    // No org context (middleware would have already 403'd, but the handler must
    // fail closed rather than insert a posting with a missing/undefined org).
    const ctx = makeCtx({
      organizationId: undefined,
      _body: { title: 'Engineer', organizationName: 'Acme', organizationId: 'tenant-B' },
    });

    const response = await createJobPosting(ctx);
    expect(response.status).toBe(403);
  });
});

describe('[M15] createJobPosting employment types', () => {
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

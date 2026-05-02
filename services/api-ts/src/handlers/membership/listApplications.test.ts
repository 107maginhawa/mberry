import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { listApplications } from './listApplications';
import { MembershipRepository } from './repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeApplications = [
  {
    application: { id: 'app-1', orgId: 'org-1', personId: 'p-1', status: 'submitted' },
    person: { id: 'p-1', firstName: 'Alice', lastName: 'Smith' },
  },
  {
    application: { id: 'app-2', orgId: 'org-1', personId: 'p-2', status: 'approved' },
    person: { id: 'p-2', firstName: 'Bob', lastName: 'Jones' },
  },
];

// ─── Tests ──────────────────────────────────────────────

describe('listApplications', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns applications with 200', async () => {
    mocks = stubRepo(MembershipRepository, {
      listApplications: async () => fakeApplications,
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
    });

    const response = await listApplications(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });

  test('passes orgId and status filter to repo', async () => {
    let capturedOrgId: string | null = null;
    let capturedStatus: string | undefined = undefined;
    mocks = stubRepo(MembershipRepository, {
      listApplications: async (orgId: string, status?: string) => {
        capturedOrgId = orgId;
        capturedStatus = status;
        return [];
      },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-22' },
      _query: { status: 'submitted' },
    });

    await listApplications(ctx);
    expect(capturedOrgId).toBe('org-22');
    expect(capturedStatus).toBe('submitted');
  });

  test('passes null status when no filter', async () => {
    let capturedStatus: string | null | undefined = 'not-called';
    mocks = stubRepo(MembershipRepository, {
      listApplications: async (_orgId: string, status?: string) => {
        capturedStatus = status ?? null;
        return [];
      },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
    });

    await listApplications(ctx);
    expect(capturedStatus).toBeNull();
  });

  test('returns empty list when no applications', async () => {
    mocks = stubRepo(MembershipRepository, {
      listApplications: async () => [],
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
    });

    const response = await listApplications(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
  });
});

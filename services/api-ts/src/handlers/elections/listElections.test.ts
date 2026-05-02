import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { listElections } from './listElections';
import { ElectionsRepository } from './repos/elections.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeElections = [
  { id: 'e-1', organizationId: 'org-1', title: '2026 Board Election', status: 'draft' },
  { id: 'e-2', organizationId: 'org-1', title: 'Bylaw Amendment', status: 'voting_open' },
];

// ─── Tests ──────────────────────────────────────────────

describe('listElections', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns elections for the org', async () => {
    mocks = stubRepo(ElectionsRepository, {
      list: async () => fakeElections,
    });

    const ctx = makeCtx({ _params: { orgId: 'org-1' } });
    const response = await listElections(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].title).toBe('2026 Board Election');
  });

  test('returns empty array when no elections', async () => {
    mocks = stubRepo(ElectionsRepository, {
      list: async () => [],
    });

    const ctx = makeCtx({ _params: { orgId: 'org-1' } });
    const response = await listElections(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  test('passes orgId from route param to repo', async () => {
    let capturedOrgId: string = '';
    mocks = stubRepo(ElectionsRepository, {
      list: async (orgId: string) => { capturedOrgId = orgId; return []; },
    });

    const ctx = makeCtx({ _params: { orgId: 'org-42' } });
    await listElections(ctx);
    expect(capturedOrgId).toBe('org-42');
  });
});

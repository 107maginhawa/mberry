import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listElections } from './listElections';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeElection = {
  id: 'elec-1',
  organizationId: 'tenant-1',
  title: 'Board Election 2024',
  status: 'active',
  type: 'board',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ─── Tests ──────────────────────────────────────────────

describe('listElections', () => {
  afterEach(() => restoreRepo(ElectionsRepository));

  test('happy path — returns list wrapped in data', async () => {
    stubRepo(ElectionsRepository, {
      list: async () => [fakeElection],
    });

    const ctx = makeCtx({ _query: {} });
    const res = await listElections(ctx);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('elec-1');
    expect(res.body.data[0].title).toBe('Board Election 2024');
  });

  test('empty org — returns empty data array', async () => {
    stubRepo(ElectionsRepository, {
      list: async () => [],
    });

    const ctx = makeCtx({ _query: {} });
    const res = await listElections(ctx);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('status filter — passes filter to repo', async () => {
    let capturedFilters: any;
    stubRepo(ElectionsRepository, {
      list: async (_orgId: string, filters: any) => {
        capturedFilters = filters;
        return [];
      },
    });

    const ctx = makeCtx({ _query: { status: 'closed' } });
    await listElections(ctx);

    expect(capturedFilters.status).toBe('closed');
  });

  test('throws on missing session (unauthorized)', async () => {
    stubRepo(ElectionsRepository, {
      list: async () => [],
    });

    const ctx = makeCtx({ user: null, session: null, _query: {} });
    await expect(listElections(ctx)).rejects.toThrow();
  });

  test('missing org context — returns 403', async () => {
    stubRepo(ElectionsRepository, {
      list: async () => [],
    });

    // Pass organizationId as empty string to simulate missing org
    const ctx = makeCtx({ organizationId: '', _query: {} });
    const res = await listElections(ctx);

    expect(res.status).toBe(403);
  });

  test('multiple elections returned in order from repo', async () => {
    const elections = [
      { ...fakeElection, id: 'elec-1' },
      { ...fakeElection, id: 'elec-2', title: 'Committee Election' },
    ];
    stubRepo(ElectionsRepository, {
      list: async () => elections,
    });

    const ctx = makeCtx({ _query: {} });
    const res = await listElections(ctx);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe('elec-1');
    expect(res.body.data[1].id).toBe('elec-2');
  });
});

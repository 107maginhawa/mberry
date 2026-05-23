import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommitteeRepository } from '@/handlers/association:operations/repos/committee.repo';
import { listAllCommittees } from './listAllCommittees';

const fakeCommittees = [
  {
    id: 'committee-1',
    organizationId: 'org-1',
    name: 'Ethics Committee',
    description: 'Handles ethical reviews',
    status: 'active',
    dissolvedAt: null,
    dissolvedBy: null,
    dissolutionReason: null,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    memberCount: 5,
  },
  {
    id: 'committee-2',
    organizationId: 'org-2',
    name: 'Education Committee',
    description: 'Manages CPD programs',
    status: 'completed',
    dissolvedAt: new Date('2026-03-01'),
    dissolvedBy: 'user-1',
    dissolutionReason: 'Mandate completed',
    createdAt: new Date('2025-06-01'),
    updatedAt: new Date('2026-03-01'),
    memberCount: 3,
  },
];

describe('listAllCommittees', () => {
  beforeEach(() => {
    restoreRepo(CommitteeRepository);
    stubRepo(CommitteeRepository, { listAll: async () => fakeCommittees });
  });

  afterEach(() => {
    restoreRepo(CommitteeRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _query: {} });
    const res = await listAllCommittees(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with committee list including memberCount', async () => {
    const ctx = makeCtx({ _query: {} });
    const res = await listAllCommittees(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe('Ethics Committee');
    expect(body.data[0].memberCount).toBe(5);
    expect(body.data[1].name).toBe('Education Committee');
    expect(body.data[1].memberCount).toBe(3);
    expect(body.data[1].status).toBe('completed');
  });

  test('passes limit from query params', async () => {
    let capturedLimit: number | undefined;
    restoreRepo(CommitteeRepository);
    stubRepo(CommitteeRepository, {
      listAll: async (limit?: number, offset?: number) => {
        capturedLimit = limit;
        return fakeCommittees.slice(0, limit ?? fakeCommittees.length);
      },
    });

    const ctx = makeCtx({ _query: { limit: '1' } });
    const res = await listAllCommittees(ctx);
    expect(res.status).toBe(200);
    expect(capturedLimit).toBe(1);
  });

  test('caps limit at 500', async () => {
    let capturedLimit: number | undefined;
    restoreRepo(CommitteeRepository);
    stubRepo(CommitteeRepository, {
      listAll: async (limit?: number) => {
        capturedLimit = limit;
        return [];
      },
    });

    const ctx = makeCtx({ _query: { limit: '9999' } });
    await listAllCommittees(ctx);
    expect(capturedLimit).toBe(500);
  });

  test('returns empty array when no committees', async () => {
    restoreRepo(CommitteeRepository);
    stubRepo(CommitteeRepository, { listAll: async () => [] });
    const ctx = makeCtx({ _query: {} });
    const res = await listAllCommittees(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toHaveLength(0);
  });
});

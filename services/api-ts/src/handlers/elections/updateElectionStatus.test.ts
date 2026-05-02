import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { updateElectionStatus } from './updateElectionStatus';
import { ElectionsRepository } from './repos/elections.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeElection = {
  id: 'election-1',
  organizationId: 'org-1',
  title: '2026 Board Election',
  status: 'draft',
};

// ─── Tests ──────────────────────────────────────────────

describe('updateElectionStatus', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('updates status and returns 200', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      update: async (_id: string, data: any) => ({ ...fakeElection, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'nominations_open' },
    });

    const response = await updateElectionStatus(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('nominations_open');
  });

  test('sets publishedAt when status is published', async () => {
    let capturedData: any;
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'awaiting_confirmation' }),
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeElection, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'published' },
    });

    await updateElectionStatus(ctx);
    expect(capturedData.publishedAt).toBeInstanceOf(Date);
  });

  test('does not set publishedAt for non-published status', async () => {
    let capturedData: any;
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeElection, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'voting_open' },
    });

    await updateElectionStatus(ctx);
    expect(capturedData.publishedAt).toBeUndefined();
  });

  test('throws NotFoundError when election does not exist', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => undefined,
      update: async () => fakeElection,
    });

    const ctx = makeCtx({
      _params: { id: 'missing-id' },
      _body: { status: 'voting_open' },
    });

    await expect(updateElectionStatus(ctx)).rejects.toThrow('Election not found');
  });

  test('transitions to cancelled status', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      update: async (_id: string, data: any) => ({ ...fakeElection, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'cancelled' },
    });

    const response = await updateElectionStatus(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('cancelled');
  });
});

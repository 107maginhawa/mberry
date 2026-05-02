import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { createElection } from './createElection';
import { ElectionsRepository } from './repos/elections.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeElection = {
  id: 'election-1',
  organizationId: 'org-1',
  title: '2026 Board Election',
  type: 'officer',
  status: 'draft',
  votingMode: 'online',
  positions: [{ id: 'pos-1', title: 'President', sortOrder: 0 }],
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('createElection', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('creates election and returns 201', async () => {
    mocks = stubRepo(ElectionsRepository, {
      create: async (data: any) => ({ ...fakeElection, ...data }),
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        title: '2026 Board Election',
        type: 'officer',
        votingMode: 'online',
        positions: [{ id: 'pos-1', title: 'President', sortOrder: 0 }],
      },
    });

    const response = await createElection(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.title).toBe('2026 Board Election');
    expect(response.body.data.status).toBe('draft');
  });

  test('uses orgId from route param', async () => {
    let capturedData: any;
    mocks = stubRepo(ElectionsRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeElection, ...data }; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-42' },
      _body: { title: 'Test Election' },
    });

    await createElection(ctx);
    expect(capturedData.organizationId).toBe('org-42');
  });

  test('defaults type to officer when not provided', async () => {
    let capturedData: any;
    mocks = stubRepo(ElectionsRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeElection, ...data }; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: { title: 'Test Election' },
    });

    await createElection(ctx);
    expect(capturedData.type).toBe('officer');
  });

  test('defaults votingMode to online when not provided', async () => {
    let capturedData: any;
    mocks = stubRepo(ElectionsRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeElection, ...data }; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: { title: 'Test Election' },
    });

    await createElection(ctx);
    expect(capturedData.votingMode).toBe('online');
  });

  test('sets createdBy and updatedBy from session', async () => {
    let capturedData: any;
    mocks = stubRepo(ElectionsRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeElection, ...data }; },
    });

    const ctx = makeCtx({
      user: { id: 'admin-99', role: 'admin' },
      _params: { orgId: 'org-1' },
      _body: { title: 'Test Election' },
    });

    await createElection(ctx);
    expect(capturedData.createdBy).toBe('admin-99');
    expect(capturedData.updatedBy).toBe('admin-99');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(ElectionsRepository, {
      create: async (data: any) => ({ ...fakeElection, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { orgId: 'org-1' },
      _body: { title: 'Test Election' },
    });

    await expect(createElection(ctx)).rejects.toThrow();
  });

  test('passes date fields as Date objects', async () => {
    let capturedData: any;
    mocks = stubRepo(ElectionsRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeElection, ...data }; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        title: 'Test Election',
        nominationsOpenAt: '2026-06-01T00:00:00Z',
        votingOpenAt: '2026-07-01T00:00:00Z',
        votingCloseAt: '2026-07-15T00:00:00Z',
      },
    });

    await createElection(ctx);
    expect(capturedData.nominationsOpenAt).toBeInstanceOf(Date);
    expect(capturedData.votingOpenAt).toBeInstanceOf(Date);
    expect(capturedData.votingCloseAt).toBeInstanceOf(Date);
  });
});

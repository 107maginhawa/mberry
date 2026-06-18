import { describe, it, test, expect, beforeEach, afterEach } from 'bun:test';
import { SavedSegmentRepository, CommunicationsRepository } from './repos/communication.repo';
import { makeCtx, makeMockDb, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import {
  createSavedSegment,
  listSavedSegments,
  deleteSavedSegment,
} from './savedSegments';

/**
 * VS-032 — Saved Segments + Stats integration tests.
 *
 * These tests use mock database instances to validate repository logic
 * without requiring a live database connection.
 */

// ---------------------------------------------------------------------------
// Mock database helpers
// ---------------------------------------------------------------------------

function createMockDb(store: Record<string, any[]> = {}) {
  const segments: any[] = store.segments ?? [];

  return {
    insert: (_table: any) => ({
      values: (data: any) => ({
        returning: () => {
          const row = { id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), version: 1, ...data };
          segments.push(row);
          return [row];
        },
      }),
    }),
    select: (_fields?: any) => ({
      from: (_table: any) => ({
        where: (_cond: any) => ({
          orderBy: (_order: any) => ({
            limit: (_n: number) => Promise.resolve([...segments]),
          }),
          limit: (_n: number) => segments,
        }),
      }),
    }),
    delete: (_table: any) => ({
      where: (_cond: any) => {
        // Remove first matching segment
        const idx = segments.findIndex(() => true);
        if (idx >= 0) segments.splice(idx, 1);
      },
    }),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests: Saved Segment CRUD
// ---------------------------------------------------------------------------

describe('SavedSegmentRepository', () => {
  let db: any;
  let store: { segments: any[] };

  beforeEach(() => {
    store = { segments: [] };
    db = createMockDb(store);
  });

  it('creates a saved segment', async () => {
    const repo = new SavedSegmentRepository(db);
    const result = await repo.create({
      organizationId: 'org-1',
      name: 'Active Regulars',
      filters: { duesStatus: 'active', membershipTier: 'regular' },
    });

    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.name).toBe('Active Regulars');
    expect(result.filters).toEqual({ duesStatus: 'active', membershipTier: 'regular' });
    expect(result.organizationId).toBe('org-1');
  });

  it('lists saved segments for an org', async () => {
    const repo = new SavedSegmentRepository(db);
    await repo.create({
      organizationId: 'org-1',
      name: 'Segment A',
      filters: { duesStatus: 'active' },
    });
    await repo.create({
      organizationId: 'org-1',
      name: 'Segment B',
      filters: { membershipTier: 'fellow' },
    });

    const list = await repo.list('org-1');
    expect(list.length).toBe(2);
    expect(list[0].name).toBe('Segment A');
    expect(list[1].name).toBe('Segment B');
  });

  it('deletes a saved segment', async () => {
    const repo = new SavedSegmentRepository(db);
    const created = await repo.create({
      organizationId: 'org-1',
      name: 'To Delete',
      filters: { duesStatus: 'expired' },
    });

    expect(store.segments.length).toBe(1);
    await repo.delete(created.id, 'org-1');
    expect(store.segments.length).toBe(0);
  });

  it('CRUD lifecycle: create → list → delete → verify gone', async () => {
    const repo = new SavedSegmentRepository(db);

    // Create
    const seg = await repo.create({
      organizationId: 'org-1',
      name: 'Lifecycle Test',
      filters: { cpdCompliant: true, joinedAfter: '2024-01-01' },
    });
    expect(seg.name).toBe('Lifecycle Test');

    // List
    const afterCreate = await repo.list('org-1');
    expect(afterCreate.length).toBe(1);

    // Delete
    await repo.delete(seg.id, 'org-1');

    // Verify gone
    const afterDelete = await repo.list('org-1');
    expect(afterDelete.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Stats writeback
// ---------------------------------------------------------------------------

describe('CommunicationsRepository.createStats', () => {
  it('creates stats with delivery counts', async () => {
    const statsStore: any[] = [];
    const db = {
      insert: (_table: any) => ({
        values: (data: any) => {
          const row = { id: crypto.randomUUID(), ...data };
          statsStore.push(row);
          return { returning: undefined };
        },
      }),
      select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => [] }), limit: () => [] }) }) }),
      delete: () => ({ where: () => {} }),
    } as any;

    const repo = new CommunicationsRepository(db);
    await repo.createStats('ann-1', 50, 'org-1', {
      emailSent: 45,
      pushDelivered: 30,
      inappViews: 20,
    });

    expect(statsStore.length).toBe(1);
    expect(statsStore[0].announcementId).toBe('ann-1');
    expect(statsStore[0].recipients).toBe(50);
    expect(statsStore[0].emailSent).toBe(45);
    expect(statsStore[0].pushDelivered).toBe(30);
    expect(statsStore[0].inappViews).toBe(20);
  });

  it('defaults delivery counts to 0 when not provided', async () => {
    const statsStore: any[] = [];
    const db = {
      insert: (_table: any) => ({
        values: (data: any) => {
          statsStore.push({ id: crypto.randomUUID(), ...data });
          return { returning: undefined };
        },
      }),
      select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => [] }), limit: () => [] }) }) }),
      delete: () => ({ where: () => {} }),
    } as any;

    const repo = new CommunicationsRepository(db);
    await repo.createStats('ann-2', 10, 'org-1');

    expect(statsStore[0].emailSent).toBe(0);
    expect(statsStore[0].pushDelivered).toBe(0);
    expect(statsStore[0].inappViews).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Handler-level tests (use makeCtx + stubRepo harness)
// ---------------------------------------------------------------------------

const FAKE_SEGMENT_HANDLER = {
  id: 'seg-h1',
  organizationId: 'org-1',
  name: 'Handler Segment',
  filters: { status: 'active' },
  createdBy: 'user-1',
  createdAt: new Date(),
};

describe('createSavedSegment handler', () => {
  beforeEach(() => { restoreRepo(SavedSegmentRepository); });
  afterEach(() => { restoreRepo(SavedSegmentRepository); });

  test('returns 401 when no session', async () => {
    const ctx = makeCtx({ session: null, user: null, database: makeMockDb() });
    ctx.req.json = async () => ({ organizationId: 'org-1', name: 'Test', filters: {} });
    const res = await createSavedSegment(ctx as any);
    expect(res.status).toBe(401);
  });

  test('returns 400 when organizationId is missing', async () => {
    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.json = async () => ({ name: 'Test', filters: { status: 'active' } });
    const res = await createSavedSegment(ctx as any);
    expect(res.status).toBe(400);
    expect((res as any).body.error).toMatch(/organizationId/);
  });

  test('returns 400 when filters is missing', async () => {
    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.json = async () => ({ organizationId: 'org-1', name: 'Test' });
    const res = await createSavedSegment(ctx as any);
    expect(res.status).toBe(400);
    expect((res as any).body.error).toMatch(/filters/);
  });

  test('returns 400 when name exceeds 100 characters', async () => {
    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.json = async () => ({
      organizationId: 'org-1',
      name: 'A'.repeat(101),
      filters: {},
    });
    const res = await createSavedSegment(ctx as any);
    expect(res.status).toBe(400);
    expect((res as any).body.error).toMatch(/100/);
  });

  test('happy path — returns 201 with segment data', async () => {
    stubRepo(SavedSegmentRepository, {
      create: async () => ({ ...FAKE_SEGMENT_HANDLER }),
    });
    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.json = async () => ({
      organizationId: 'org-1',
      name: 'Handler Segment',
      filters: { status: 'active' },
    });
    const res = await createSavedSegment(ctx as any);
    expect(res.status).toBe(201);
    expect((res as any).body.data.id).toBe('seg-h1');
  });

  test('name is trimmed before repo call', async () => {
    let captured: any;
    stubRepo(SavedSegmentRepository, {
      create: async (d: any) => { captured = d; return { ...FAKE_SEGMENT_HANDLER, name: d.name }; },
    });
    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.json = async () => ({
      organizationId: 'org-1',
      name: '  Spaced  ',
      filters: {},
    });
    await createSavedSegment(ctx as any);
    expect(captured.name).toBe('Spaced');
  });

  test('createdBy is session.user.id', async () => {
    let captured: any;
    stubRepo(SavedSegmentRepository, {
      create: async (d: any) => { captured = d; return { ...FAKE_SEGMENT_HANDLER }; },
    });
    const ctx = makeCtx({
      database: makeMockDb(),
      user: { id: 'creator-7', role: 'user', twoFactorEnabled: true },
    });
    ctx.req.json = async () => ({ organizationId: 'org-1', name: 'X', filters: {} });
    await createSavedSegment(ctx as any);
    expect(captured.createdBy).toBe('creator-7');
  });
});

describe('listSavedSegments handler', () => {
  beforeEach(() => { restoreRepo(SavedSegmentRepository); });
  afterEach(() => { restoreRepo(SavedSegmentRepository); });

  test('returns 401 when no session', async () => {
    const ctx = makeCtx({ session: null, user: null, database: makeMockDb() });
    ctx.req.query = (k?: string) => k === 'organizationId' ? 'org-1' : null;
    const res = await listSavedSegments(ctx as any);
    expect(res.status).toBe(401);
  });

  test('returns 400 when organizationId param missing', async () => {
    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.query = (_k?: string) => null;
    const res = await listSavedSegments(ctx as any);
    expect(res.status).toBe(400);
  });

  test('happy path — returns 200 with data array', async () => {
    stubRepo(SavedSegmentRepository, {
      list: async () => [{ ...FAKE_SEGMENT_HANDLER }],
    });
    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.query = (k?: string) => k === 'organizationId' ? 'org-1' : null;
    const res = await listSavedSegments(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toHaveLength(1);
    expect((res as any).body.data[0].id).toBe('seg-h1');
  });

  test('repo.list called with correct organizationId', async () => {
    let captured: string | undefined;
    stubRepo(SavedSegmentRepository, {
      list: async (orgId: string) => { captured = orgId; return []; },
    });
    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.query = (k?: string) => k === 'organizationId' ? 'org-special' : null;
    await listSavedSegments(ctx as any);
    expect(captured).toBe('org-special');
  });
});

describe('deleteSavedSegment handler', () => {
  beforeEach(() => { restoreRepo(SavedSegmentRepository); });
  afterEach(() => { restoreRepo(SavedSegmentRepository); });

  test('returns 401 when no session', async () => {
    const ctx = makeCtx({ session: null, user: null, database: makeMockDb() });
    ctx.req.param = (_k?: string) => 'seg-h1';
    ctx.req.query = (k?: string) => k === 'organizationId' ? 'org-1' : null;
    const res = await deleteSavedSegment(ctx as any);
    expect(res.status).toBe(401);
  });

  test('returns 400 when organizationId param missing', async () => {
    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.param = (_k?: string) => 'seg-h1';
    ctx.req.query = (_k?: string) => null;
    const res = await deleteSavedSegment(ctx as any);
    expect(res.status).toBe(400);
  });

  test('happy path — returns 200 success:true', async () => {
    stubRepo(SavedSegmentRepository, {
      delete: async () => {},
    });
    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.param = (_k?: string) => 'seg-h1';
    ctx.req.query = (k?: string) => k === 'organizationId' ? 'org-1' : null;
    const res = await deleteSavedSegment(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.success).toBe(true);
  });

  test('repo.delete called with id and organizationId', async () => {
    let capturedId: string;
    let capturedOrg: string;
    stubRepo(SavedSegmentRepository, {
      delete: async (id: string, org: string) => { capturedId = id; capturedOrg = org; },
    });
    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.param = (_k?: string) => 'seg-del-99';
    ctx.req.query = (k?: string) => k === 'organizationId' ? 'org-del' : null;
    await deleteSavedSegment(ctx as any);
    expect(capturedId!).toBe('seg-del-99');
    expect(capturedOrg!).toBe('org-del');
  });
});
